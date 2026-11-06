// Pruebas HTTP de las rutas de delegaciones institucionales.
// Verifica autenticacion, aislamiento multitenant, endpoints y validacion de entradas.

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { crearAuthenticate } from '../../../../src/middlewares/authenticate';
import { errorHandler } from '../../../../src/middlewares/errorHandler';
import { AppError } from '../../../../src/shared/errors/AppError';
import type { ISesionStore } from '../../../../src/shared/security/sesionStore';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type { DelegacionesService } from '../../../../src/modules/delegaciones/delegaciones.service';
import { crearDelegacionesController } from '../../../../src/modules/delegaciones/delegaciones.controller';
import { crearDelegacionesRouter } from '../../../../src/modules/delegaciones/delegaciones.routes';

const BASE = '/api/delegaciones';

const SUPERADMIN: UsuarioAutenticado = {
  id: 10,
  empresaId: 5,
  rol: 'SUPERADMIN',
  jti: 'jti-superadmin',
  expira: 9_999_999_999,
};

const EMPLEADO: UsuarioAutenticado = {
  ...SUPERADMIN,
  id: 11,
  rol: 'EMPLEADO',
  jti: 'jti-empleado',
};

const USUARIOS_POR_TOKEN: Record<string, UsuarioAutenticado> = {
  superadmin: SUPERADMIN,
  empleado: EMPLEADO,
};

function verificarToken(token: string): Promise<UsuarioAutenticado> {
  const usuario = USUARIOS_POR_TOKEN[token];

  if (!usuario) {
    throw AppError.noAutenticado('Sesion no valida');
  }

  return Promise.resolve(usuario);
}

const sesiones: ISesionStore = {
  revocarToken: () => Promise.resolve(),
  estaRevocado: () => Promise.resolve(false),
};

const DATOS_CREACION = {
  deleganteId: 10,
  delegadoId: 20,
  vigenteDesde: '2026-11-05T08:00:00-05:00',
  vigenteHasta: '2026-11-10T17:00:00-05:00',
  motivo: ' Cobertura temporal ',
};

const DELEGACION = {
  id: 30,
  empresaId: 5,
  deleganteId: 10,
  delegadoId: 20,
  vigenteDesde: new Date('2026-11-05T13:00:00.000Z'),
  vigenteHasta: new Date('2026-11-10T22:00:00.000Z'),
  motivo: 'Cobertura temporal',
  revocadaAt: null,
};

const DELEGACION_HTTP = {
  ...DELEGACION,
  vigenteDesde: '2026-11-05T13:00:00.000Z',
  vigenteHasta: '2026-11-10T22:00:00.000Z',
};

function crearEscenario() {
  const servicio = {
    listar: vi.fn().mockResolvedValue([]),
    crear: vi.fn().mockResolvedValue(DELEGACION),
    obtener: vi.fn().mockResolvedValue(DELEGACION),
    revocar: vi.fn().mockResolvedValue(DELEGACION),
  };

  const controller = crearDelegacionesController(
    servicio as unknown as DelegacionesService,
  );

  const router = crearDelegacionesRouter({
    controller,
    autenticar: crearAuthenticate(verificarToken, sesiones),
  });

  const app = express();
  app.use(express.json());
  app.use(BASE, router);
  app.use(errorHandler);

  return { app, servicio };
}

function autenticar(
  prueba: request.Test,
  token = 'superadmin',
): request.Test {
  return prueba.set('Authorization', `Bearer ${token}`);
}

describe('DelegacionesRouter', () => {
  it('consulta las delegaciones con filtros validados y convertidos', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).get(BASE),
    )
      .query({
        deleganteId: '10',
        delegadoId: '20',
        estado: 'VIGENTE',
        pagina: '2',
        porPagina: '10',
      })
      .expect(200);

    expect(respuesta.body).toEqual([]);
    expect(servicio.listar).toHaveBeenCalledWith(SUPERADMIN, {
      deleganteId: 10,
      delegadoId: 20,
      estado: 'VIGENTE',
      pagina: 2,
      porPagina: 10,
    });
  });

  it('consulta las delegaciones con filtros predeterminados', async () => {
    const { app, servicio } = crearEscenario();

    await autenticar(request(app).get(BASE)).expect(200);

    expect(servicio.listar).toHaveBeenCalledWith(SUPERADMIN, {
      pagina: 1,
      porPagina: 20,
    });
  });

  it('rechaza filtros inválidos y no consulta el servicio', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).get(BASE),
    )
      .query({ pagina: '0' })
      .expect(400);

    expect(respuesta.body).toBeDefined();
    expect(servicio.listar).not.toHaveBeenCalled();
  });

  it('crea una delegación cuando el cuerpo es válido', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).post(BASE),
    )
      .send(DATOS_CREACION)
      .expect(201);

    expect(respuesta.body).toEqual({
      delegacion: DELEGACION_HTTP,
    });

    expect(servicio.crear).toHaveBeenCalledWith(SUPERADMIN, {
      deleganteId: 10,
      delegadoId: 20,
      vigenteDesde: new Date('2026-11-05T13:00:00.000Z'),
      vigenteHasta: new Date('2026-11-10T22:00:00.000Z'),
      motivo: 'Cobertura temporal',
    });
  });

  it('rechaza una creación con datos inválidos', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).post(BASE),
    )
      .send({
        ...DATOS_CREACION,
        delegadoId: 0,
      })
      .expect(400);

    expect(respuesta.body).toBeDefined();
    expect(servicio.crear).not.toHaveBeenCalled();
  });

  it('consulta una delegación por su identificador', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).get(`${BASE}/30`),
    ).expect(200);

    expect(respuesta.body).toEqual({
      delegacion: DELEGACION_HTTP,
    });
    expect(servicio.obtener).toHaveBeenCalledWith(SUPERADMIN, 30);
  });

  it('rechaza un identificador inválido al consultar', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).get(`${BASE}/invalido`),
    ).expect(400);

    expect(respuesta.body).toBeDefined();
    expect(servicio.obtener).not.toHaveBeenCalled();
  });

  it('revoca una delegación por su identificador', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).post(`${BASE}/30/revocar`),
    ).expect(200);

    expect(respuesta.body).toEqual({
      delegacion: DELEGACION_HTTP,
    });
    expect(servicio.revocar).toHaveBeenCalledWith(SUPERADMIN, 30);
  });

  it('rechaza un identificador inválido al revocar', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(
      request(app).post(`${BASE}/invalido/revocar`),
    ).expect(400);

    expect(respuesta.body).toBeDefined();
    expect(servicio.revocar).not.toHaveBeenCalled();
  });

  it('rechaza peticiones sin autenticación', async () => {
    const { app, servicio } = crearEscenario();

    await request(app).get(BASE).expect(401);

    expect(servicio.listar).not.toHaveBeenCalled();
  });

  it('rechaza tokens inválidos', async () => {
    const { app, servicio } = crearEscenario();

    await request(app)
      .get(BASE)
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    expect(servicio.listar).not.toHaveBeenCalled();
  });

  it('mantiene la identidad del usuario autenticado en las operaciones', async () => {
    const { app, servicio } = crearEscenario();

    await autenticar(
      request(app).get(`${BASE}/30`),
      'empleado',
    ).expect(200);

    expect(servicio.obtener).toHaveBeenCalledWith(EMPLEADO, 30);
  });
});
