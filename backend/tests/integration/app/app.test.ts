// Pruebas de la app completa con Supertest: seguridad, CORS y rutas base.
// No necesitan MySQL ni Redis porque las conexiones se abren solo al usarlas.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app';

interface CuerpoError {
  codigo: string;
  mensaje: string;
}

describe('app', () => {
  const app = crearApp();

  it('GET /salud responde ok', async () => {
    const respuesta = await request(app).get('/salud');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: 'ok' });
  });

  it('no anuncia Express y envia cabeceras de seguridad', async () => {
    const respuesta = await request(app).get('/salud');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
    expect(respuesta.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(respuesta.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('permite el origen configurado en CORS', async () => {
    const respuesta = await request(app).get('/salud').set('Origin', 'http://localhost:5173');
    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('no concede CORS a un origen desconocido', async () => {
    const respuesta = await request(app).get('/salud').set('Origin', 'https://intruso.example.com');
    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde 404 con el formato uniforme en rutas desconocidas', async () => {
    const respuesta = await request(app).get('/api/desconocida');
    const cuerpo = respuesta.body as CuerpoError;
    expect(respuesta.status).toBe(404);
    expect(cuerpo.codigo).toBe('NO_ENCONTRADO');
  });
});