// Pruebas de authenticate, multitenant y authorizeRole juntos, con doble del verificador y de Redis.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { authorizeRole } from '../../../src/middlewares/authorizeRole';
import { errorHandler } from '../../../src/middlewares/errorHandler';
import { multitenant, obtenerEmpresaId } from '../../../src/middlewares/multitenant';
import { AppError } from '../../../src/shared/errors/AppError';
import type { ISesionStore } from '../../../src/shared/security/sesionStore';
import type { UsuarioAutenticado } from '../../../src/shared/types/autenticacion';

interface CuerpoError {
  codigo: string;
  mensaje: string;
}

const jefe: UsuarioAutenticado = {
  id: 7,
  empresaId: 5,
  rol: 'JEFE_AREA',
  jti: 'jti-jefe',
  expira: 9_999_999_999,
};

// Tokens de prueba y el usuario al que corresponde cada uno
const usuariosPorToken: Record<string, UsuarioAutenticado> = {
  jefe,
  empleado: { ...jefe, id: 8, rol: 'EMPLEADO', jti: 'jti-empleado' },
  revocado: { ...jefe, jti: 'jti-revocado' },
};

function verificarFalso(token: string): Promise<UsuarioAutenticado> {
  const usuario = usuariosPorToken[token];
  return usuario
    ? Promise.resolve(usuario)
    : Promise.reject(AppError.noAutenticado('Sesion no valida'));
}

const storeFalso: ISesionStore = {
  revocarToken: () => Promise.resolve(),
  estaRevocado: (jti) => Promise.resolve(jti === 'jti-revocado'),
};

function crearAppDePrueba(): express.Express {
  const app = express();
  const authenticate = crearAuthenticate(verificarFalso, storeFalso);

  app.get(
    '/protegida',
    authenticate,
    multitenant,
    authorizeRole('JEFE_AREA', 'SUPERADMIN'),
    (req, res) => {
      res.json({ empresaId: obtenerEmpresaId(req) });
    },
  );
  app.get('/sin-autenticar', multitenant, (_req, res) => {
    res.json({});
  });
  app.use(errorHandler);
  return app;
}

describe('authenticate, multitenant y authorizeRole', () => {
  const app = crearAppDePrueba();

  it('rechaza una peticion sin cabecera Authorization', async () => {
    const respuesta = await request(app).get('/protegida');
    expect(respuesta.status).toBe(401);
    expect((respuesta.body as CuerpoError).codigo).toBe('NO_AUTENTICADO');
  });

  it('rechaza un esquema distinto de Bearer', async () => {
    const respuesta = await request(app).get('/protegida').set('Authorization', 'Basic jefe');
    expect(respuesta.status).toBe(401);
  });

  it('rechaza un token invalido', async () => {
    const respuesta = await request(app).get('/protegida').set('Authorization', 'Bearer falso');
    expect(respuesta.status).toBe(401);
  });

  it('rechaza un token revocado', async () => {
    const respuesta = await request(app).get('/protegida').set('Authorization', 'Bearer revocado');
    expect(respuesta.status).toBe(401);
    expect((respuesta.body as CuerpoError).mensaje).toBe('Sesion cerrada');
  });

  it('rechaza a un rol que no esta permitido', async () => {
    const respuesta = await request(app).get('/protegida').set('Authorization', 'Bearer empleado');
    expect(respuesta.status).toBe(403);
    expect((respuesta.body as CuerpoError).codigo).toBe('PROHIBIDO');
  });

  it('deja pasar a un rol permitido con el hospital del token', async () => {
    const respuesta = await request(app).get('/protegida').set('Authorization', 'Bearer jefe');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ empresaId: 5 });
  });

  it('multitenant rechaza una peticion sin autenticar', async () => {
    const respuesta = await request(app).get('/sin-autenticar');
    expect(respuesta.status).toBe(401);
  });
});