// Pruebas de csrf: metodos seguros libres y metodos que cambian estado con doble envio.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { COOKIE_CSRF, CABECERA_CSRF, csrf, generarTokenCsrf } from '../../../src/middlewares/csrf';
import { errorHandler } from '../../../src/middlewares/errorHandler';

interface CuerpoError {
  codigo: string;
}

function crearAppDePrueba(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use(csrf);
  app.get('/recurso', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/recurso', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('csrf', () => {
  const app = crearAppDePrueba();

  it('no exige token en GET', async () => {
    const respuesta = await request(app).get('/recurso');
    expect(respuesta.status).toBe(200);
  });

  it('rechaza un POST sin cookie ni cabecera', async () => {
    const respuesta = await request(app).post('/recurso');
    expect(respuesta.status).toBe(403);
    expect((respuesta.body as CuerpoError).codigo).toBe('PROHIBIDO');
  });

  it('rechaza un POST con la cookie pero sin la cabecera', async () => {
    const respuesta = await request(app).post('/recurso').set('Cookie', `${COOKIE_CSRF}=abc123`);
    expect(respuesta.status).toBe(403);
  });

  it('rechaza un POST cuando cookie y cabecera no coinciden', async () => {
    const respuesta = await request(app)
      .post('/recurso')
      .set('Cookie', `${COOKIE_CSRF}=abc123`)
      .set(CABECERA_CSRF, 'otro-valor');
    expect(respuesta.status).toBe(403);
  });

  it('acepta un POST cuando cookie y cabecera coinciden', async () => {
    const respuesta = await request(app)
      .post('/recurso')
      .set('Cookie', `${COOKIE_CSRF}=abc123`)
      .set(CABECERA_CSRF, 'abc123');
    expect(respuesta.status).toBe(200);
  });
});

describe('generarTokenCsrf', () => {
  it('genera tokens largos y distintos', () => {
    const primero = generarTokenCsrf();
    const segundo = generarTokenCsrf();
    expect(primero.length).toBeGreaterThanOrEqual(43);
    expect(primero).not.toBe(segundo);
  });
});