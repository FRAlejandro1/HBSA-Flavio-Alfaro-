// Pruebas de validate: limpieza de datos, conversion de tipos y errores por campo.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { validate } from '../../../src/middlewares/validate';

interface CuerpoError {
  codigo: string;
  detalles?: { campo: string; mensaje: string }[];
}

function crearAppDePrueba(): express.Express {
  const app = express();
  app.use(express.json());

  app.post(
    '/cuerpo',
    validate({ body: z.object({ nombre: z.string().trim().min(1) }) }),
    (req, res) => {
      res.json(req.body as object);
    },
  );
  app.get(
    '/lista',
    validate({ query: z.object({ pagina: z.coerce.number().int().min(1).default(1) }) }),
    (req, res) => {
      res.json({ pagina: req.query.pagina });
    },
  );
  app.get(
    '/item/:id',
    validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
    (req, res) => {
      res.json({ id: req.params.id });
    },
  );

  app.use(errorHandler);
  return app;
}

describe('validate', () => {
  const app = crearAppDePrueba();

  it('deja en el body los valores ya limpios', async () => {
    const respuesta = await request(app).post('/cuerpo').send({ nombre: '  Ana ' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ nombre: 'Ana' });
  });

  it('responde 400 con el campo que fallo', async () => {
    const respuesta = await request(app).post('/cuerpo').send({ nombre: '   ' });
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(400);
    expect(cuerpo.codigo).toBe('VALIDACION');
    expect(cuerpo.detalles?.[0]?.campo).toBe('nombre');
  });

  it('convierte los parametros de query y aplica los valores por defecto', async () => {
    const conPagina = await request(app).get('/lista?pagina=2');
    const sinPagina = await request(app).get('/lista');
    expect(conPagina.body).toEqual({ pagina: 2 });
    expect(sinPagina.body).toEqual({ pagina: 1 });
  });

  it('valida los parametros de la URL', async () => {
    const valido = await request(app).get('/item/3');
    const invalido = await request(app).get('/item/abc');
    expect(valido.body).toEqual({ id: 3 });
    expect(invalido.status).toBe(400);
  });
});