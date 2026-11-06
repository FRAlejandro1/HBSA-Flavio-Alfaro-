// Pruebas unitarias del controlador de configuracion institucional.
// Verifica la extraccion del actor, las llamadas al servicio y las respuestas HTTP.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type { ConfiguracionInstitucional } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.dominio';
import type { ConfiguracionInstitucionalService } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.service';
import { crearConfiguracionInstitucionalController } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.controller';

const ACTOR: UsuarioAutenticado = {
  id: 10,
  empresaId: 1,
  rol: 'SUPERADMIN',
  jti: 'token-superadmin',
  expira: 1_800_000_000,
};

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

function crearRespuesta(): Response {
  return {
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function crearRequest(usuario?: UsuarioAutenticado, body: unknown = {}): Request {
  return {
    usuario,
    body,
  } as unknown as Request;
}

describe('ConfiguracionInstitucionalController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const servicio = {
    obtener: vi.fn().mockResolvedValue(CONFIGURACION),
    actualizar: vi.fn().mockResolvedValue(DATOS_ACTUALIZACION),
  };

  const controlador = crearConfiguracionInstitucionalController(
    servicio as unknown as ConfiguracionInstitucionalService,
  );

  it('consulta la configuracion del actor y responde con ella', async () => {
    const req = crearRequest(ACTOR);
    const res = crearRespuesta();

    await controlador.obtener(req, res, vi.fn() as NextFunction);

    expect(servicio.obtener).toHaveBeenCalledWith(ACTOR);
    expect(res.json).toHaveBeenCalledWith({
      configuracion: CONFIGURACION,
    });
  });

  it('rechaza la consulta cuando no existe un actor autenticado', async () => {
    const req = crearRequest();
    const res = crearRespuesta();

    await expect(
      controlador.obtener(req, res, vi.fn() as NextFunction),
    ).rejects.toBeDefined();

    expect(servicio.obtener).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('actualiza la configuracion con el actor y los datos del cuerpo', async () => {
    const req = crearRequest(ACTOR, DATOS_ACTUALIZACION);
    const res = crearRespuesta();

    await controlador.actualizar(req, res, vi.fn() as NextFunction);

    expect(servicio.actualizar).toHaveBeenCalledWith(
      ACTOR,
      DATOS_ACTUALIZACION,
    );
    expect(res.json).toHaveBeenCalledWith({
      configuracion: DATOS_ACTUALIZACION,
    });
  });

  it('rechaza la actualizacion cuando no existe un actor autenticado', async () => {
    const req = crearRequest(undefined, DATOS_ACTUALIZACION);
    const res = crearRespuesta();

    await expect(
      controlador.actualizar(req, res, vi.fn() as NextFunction),
    ).rejects.toBeDefined();

    expect(servicio.actualizar).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
