// Pruebas de errorHandler y rutaNoEncontrada sobre una app minima con Supertest.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { AppError } from '../../../src/shared/errors/AppError';

interface CuerpoError {
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

// App con una ruta por cada tipo de error que el handler debe traducir
function crearAppDePrueba(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/prohibido', () => {
    throw AppError.prohibido('No puedes cancelar esta solicitud');
  });
  app.get('/con-detalles', () => {
    throw AppError.reglaDeNegocio('Saldo insuficiente', { disponible: 3 });
  });
  app.get('/zod', () => {
    z.object({ cedula: z.string() }).parse({});
  });
  app.get('/inesperado', () => {
    throw new Error('clave interna que no debe filtrarse');
  });
  app.post('/json', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(rutaNoEncontrada);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = crearAppDePrueba();

  it('traduce un AppError a su estado y codigo', async () => {
    const respuesta = await request(app).get('/prohibido');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(403);
    expect(cuerpo).toEqual({ codigo: 'PROHIBIDO', mensaje: 'No puedes cancelar esta solicitud' });
  });

  it('incluye los detalles cuando existen', async () => {
    const respuesta = await request(app).get('/con-detalles');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(422);
    expect(cuerpo.detalles).toEqual({ disponible: 3 });
  });

  it('traduce un error de Zod a 400 con el campo afectado', async () => {
    const respuesta = await request(app).get('/zod');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(400);
    expect(cuerpo.codigo).toBe('VALIDACION');
    expect(cuerpo.detalles).toEqual([{ campo: 'cedula', mensaje: expect.any(String) as string }]);
  });

  it('responde 400 ante un JSON mal formado', async () => {
    const respuesta = await request(app)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"roto":');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(400);
    expect(cuerpo.codigo).toBe('VALIDACION');
  });

  it('responde 500 generico sin filtrar el mensaje interno', async () => {
    const respuesta = await request(app).get('/inesperado');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(500);
    expect(cuerpo.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(cuerpo)).not.toContain('clave interna');
  });

  it('responde 404 en rutas que no existen', async () => {
    const respuesta = await request(app).get('/no-existe');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(404);
    expect(cuerpo.codigo).toBe('NO_ENCONTRADO');
  });
});