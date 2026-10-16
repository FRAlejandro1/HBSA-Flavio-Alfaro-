// Comprueba que la app real tiene montado el modulo auth y el CSRF global.
// No necesita MySQL ni Redis: ninguna de estas peticiones llega a consultarlos.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app';

interface CuerpoError {
  codigo: string;
}

describe('montaje de auth en la app', () => {
  const app = crearApp();

  it('GET /api/auth/csrf responde con un token y sin cache', async () => {
    const respuesta = await request(app).get('/api/auth/csrf');
    expect(respuesta.status).toBe(200);
    expect((respuesta.body as { csrfToken: string }).csrfToken).toBeTruthy();
    expect(respuesta.headers['cache-control']).toBe('no-store');
  });

  it('un POST sin token CSRF se rechaza antes de llegar al modulo', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'jefe@hospital.test', clave: 'cualquiera' });
    expect(respuesta.status).toBe(403);
    expect((respuesta.body as CuerpoError).codigo).toBe('PROHIBIDO');
  });

  it('las rutas protegidas piden autenticacion', async () => {
    const respuesta = await request(app).get('/api/auth/me');
    expect(respuesta.status).toBe(401);
  });
});