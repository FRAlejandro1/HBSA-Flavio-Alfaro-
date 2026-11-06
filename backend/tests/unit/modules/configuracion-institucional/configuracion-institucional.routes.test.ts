// Pruebas HTTP de las rutas de configuracion institucional.
// Verifica autenticacion, aislamiento multitenant, permisos y validacion de entradas.

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { crearAuthenticate } from '../../../../src/middlewares/authenticate';
import { errorHandler } from '../../../../src/middlewares/errorHandler';
import { AppError } from '../../../../src/shared/errors/AppError';
import type { ISesionStore } from '../../../../src/shared/security/sesionStore';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type { ConfiguracionInstitucional } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.dominio';
import type { ConfiguracionInstitucionalService } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.service';
import { crearConfiguracionInstitucionalController } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.controller';
import { crearConfiguracionInstitucionalRouter } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.routes';

const BASE = '/api/configuracion-institucional';

const CONFIGURACION: ConfiguracionInstitucional = {
  plazoHoras: 48,
  diasVacacionesAnuales: 30,
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: 3,
};

const DATOS_ACTUALIZACION = {
  plazoHoras: 36.5,
  diasVacacionesAnuales: 25.5,
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: 5,
};

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

function crearEscenario() {
  const servicio = {
    obtener: vi.fn().mockResolvedValue(CONFIGURACION),
    actualizar: vi.fn().mockResolvedValue(DATOS_ACTUALIZACION),
  };

  const controller = crearConfiguracionInstitucionalController(
    servicio as unknown as ConfiguracionInstitucionalService,
  );

  const router = crearConfiguracionInstitucionalRouter({
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

describe('ConfiguracionInstitucionalRouter', () => {
  it('consulta la configuracion del hospital autenticado', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(request(app).get(BASE)).expect(200);

    expect(respuesta.body).toEqual({
      configuracion: CONFIGURACION,
    });
    expect(servicio.obtener).toHaveBeenCalledWith(SUPERADMIN);
  });

  it('actualiza la configuracion cuando el cuerpo es valido', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(request(app).put(BASE))
      .send(DATOS_ACTUALIZACION)
      .expect(200);

    expect(respuesta.body).toEqual({
      configuracion: DATOS_ACTUALIZACION,
    });
    expect(servicio.actualizar).toHaveBeenCalledWith(
      SUPERADMIN,
      DATOS_ACTUALIZACION,
    );
  });

  it('rechaza una actualizacion con datos invalidos', async () => {
    const { app, servicio } = crearEscenario();

    const respuesta = await autenticar(request(app).put(BASE))
      .send({
        ...DATOS_ACTUALIZACION,
        plazoHoras: -1,
      })
      .expect(400);

    expect(respuesta.body).toBeDefined();
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });

  it('rechaza una peticion sin autenticacion', async () => {
    const { app, servicio } = crearEscenario();

    await request(app).get(BASE).expect(401);

    expect(servicio.obtener).not.toHaveBeenCalled();
  });

  it('rechaza a un usuario que no tiene el rol SUPERADMIN', async () => {
    const { app, servicio } = crearEscenario();

    await autenticar(request(app).get(BASE), 'empleado').expect(403);

    expect(servicio.obtener).not.toHaveBeenCalled();
  });
});
