// Pruebas unitarias del controlador de delegaciones.
// Verifica autenticacion, extraccion de parametros, llamadas al servicio y respuestas HTTP.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type { Delegacion } from '../../../../src/modules/delegaciones/delegaciones.dominio';
import type { DelegacionesService } from '../../../../src/modules/delegaciones/delegaciones.service';
import { crearDelegacionesController } from '../../../../src/modules/delegaciones/delegaciones.controller';

const ACTOR: UsuarioAutenticado = {
  id: 10,
  empresaId: 1,
  rol: 'JEFE_AREA',
  jti: 'token-jefe',
  expira: 1_800_000_000,
};

const DELEGACION: Delegacion = {
  id: 5,
  delegante: {
    id: 10,
    nombres: 'Ana',
    apellidos: 'Lopez',
  },
  delegado: {
    id: 20,
    nombres: 'Luis',
    apellidos: 'Perez',
  },
  creadaPorId: 10,
  vigenteDesde: new Date('2026-11-05T15:00:00.000Z'),
  vigenteHasta: new Date('2026-11-10T15:00:00.000Z'),
  motivo: 'Ausencia temporal',
  revocadaAt: null,
  estado: 'PROGRAMADA',
  creadaAt: new Date('2026-11-04T15:00:00.000Z'),
};

const FILTROS = {
  deleganteId: '10',
  delegadoId: '20',
  estado: 'VIGENTE',
  pagina: '1',
  porPagina: '10',
};

const DATOS_CREACION = {
  delegadoId: 20,
  vigenteDesde: '2026-11-05T15:00:00.000Z',
  vigenteHasta: '2026-11-10T15:00:00.000Z',
  motivo: 'Ausencia temporal',
};

function crearRequest(
  usuario?: UsuarioAutenticado,
  opciones: {
    query?: Record<string, unknown>;
    params?: Record<string, string>;
    body?: unknown;
  } = {},
): Request {
  return {
    usuario,
    query: opciones.query ?? {},
    params: opciones.params ?? {},
    body: opciones.body ?? {},
  } as unknown as Request;
}

function crearRespuesta() {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();

  const res = { json, status } as unknown as Response;

  return { res, json, status };
}

describe('DelegacionesController', () => {
  const listar = vi.fn();
  const obtener = vi.fn();
  const crear = vi.fn();
  const revocar = vi.fn();

  const servicio = {
    listar,
    obtener,
    crear,
    revocar,
  };

  const controlador = crearDelegacionesController(
    servicio as unknown as DelegacionesService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    servicio.listar.mockResolvedValue({
      delegaciones: [DELEGACION],
      total: 1,
    });
    servicio.obtener.mockResolvedValue(DELEGACION);
    servicio.crear.mockResolvedValue(DELEGACION);
    servicio.revocar.mockResolvedValue({
      ...DELEGACION,
      revocadaAt: new Date('2026-11-04T16:00:00.000Z'),
      estado: 'REVOCADA',
    });
  });

  describe('listar', () => {
    it('extrae el actor y los filtros y responde con el resultado', async () => {
      const req = crearRequest(ACTOR, { query: FILTROS });
      const { res, json } = crearRespuesta();

      await controlador.listar(req, res, vi.fn() as NextFunction);

      expect(listar).toHaveBeenCalledOnce();
      expect(listar).toHaveBeenCalledWith(ACTOR, FILTROS);
      expect(json).toHaveBeenCalledWith({
        delegaciones: [DELEGACION],
        total: 1,
      });
    });

    it('rechaza la solicitud cuando no existe un actor autenticado', async () => {
      const req = crearRequest(undefined, { query: FILTROS });
      const { res, json } = crearRespuesta();

      await expect(
        controlador.listar(req, res, vi.fn() as NextFunction),
      ).rejects.toBeDefined();

      expect(listar).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('extrae el identificador y responde con la delegacion', async () => {
      const req = crearRequest(ACTOR, {
        params: { id: '5' },
      });
      const { res, json } = crearRespuesta();

      await controlador.obtener(req, res, vi.fn() as NextFunction);

      expect(obtener).toHaveBeenCalledWith(ACTOR, 5);
      expect(json).toHaveBeenCalledWith({
        delegacion: DELEGACION,
      });
    });

    it('rechaza la solicitud cuando no existe un actor autenticado', async () => {
      const req = crearRequest(undefined, {
        params: { id: '5' },
      });
      const { res, json } = crearRespuesta();

      await expect(
        controlador.obtener(req, res, vi.fn() as NextFunction),
      ).rejects.toBeDefined();

      expect(obtener).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('crear', () => {
    it('extrae el actor y el cuerpo y responde con estado 201', async () => {
      const req = crearRequest(ACTOR, {
        body: DATOS_CREACION,
      });
      const { res, json, status } = crearRespuesta();

      await controlador.crear(req, res, vi.fn() as NextFunction);

      expect(crear).toHaveBeenCalledOnce();
      expect(crear).toHaveBeenCalledWith(ACTOR, DATOS_CREACION);
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith({
        delegacion: DELEGACION,
      });
    });

    it('rechaza la solicitud cuando no existe un actor autenticado', async () => {
      const req = crearRequest(undefined, {
        body: DATOS_CREACION,
      });
      const { res, json, status } = crearRespuesta();

      await expect(
        controlador.crear(req, res, vi.fn() as NextFunction),
      ).rejects.toBeDefined();

      expect(crear).not.toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('revocar', () => {
    it('extrae el identificador y responde con la delegacion revocada', async () => {
      const delegacionRevocada = {
        ...DELEGACION,
        revocadaAt: new Date('2026-11-04T16:00:00.000Z'),
        estado: 'REVOCADA',
      };
      servicio.revocar.mockResolvedValue(delegacionRevocada);

      const req = crearRequest(ACTOR, {
        params: { id: '5' },
      });
      const { res, json } = crearRespuesta();

      await controlador.revocar(req, res, vi.fn() as NextFunction);

      expect(revocar).toHaveBeenCalledWith(ACTOR, 5);
      expect(json).toHaveBeenCalledWith({
        delegacion: delegacionRevocada,
      });
    });

    it('rechaza la solicitud cuando no existe un actor autenticado', async () => {
      const req = crearRequest(undefined, {
        params: { id: '5' },
      });
      const { res, json } = crearRespuesta();

      await expect(
        controlador.revocar(req, res, vi.fn() as NextFunction),
      ).rejects.toBeDefined();

      expect(revocar).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });
});
