// Traduce HTTP a llamadas del service de configuracion. El hospital y quien cambia salen siempre del token,
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type { DiasVacacionesEntrada } from './vacaciones.configuracion.validators';
import type { PeriodosService } from './vacaciones.periodos.service';

export interface ConfiguracionVacacionesController {
  obtenerDiasDeArea: RequestHandler;
  fijarDiasDeArea: RequestHandler;
  obtenerDiasDePersona: RequestHandler;
  fijarDiasDePersona: RequestHandler;
}

// authenticate ya dejo al usuario en la peticion; si falta, la sesion no es valida
function obtenerActor(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

// validate ya convirtio el id en numero; aqui solo se lee con el tipo correcto
function leerId(req: Request): number {
  const bruto: unknown = req.params.id;
  const id =
    typeof bruto === 'number'
      ? bruto
      : typeof bruto === 'string'
        ? Number.parseFloat(bruto)
        : Number.NaN;
  if (Number.isNaN(id)) {
    throw AppError.validacion('Identificador invalido');
  }
  return id;
}

export function crearConfiguracionVacacionesController(servicio: PeriodosService): ConfiguracionVacacionesController {
  return {
    obtenerDiasDeArea: async (req, res) => {
      const configuracion = await servicio.obtenerDeArea(obtenerActor(req).empresaId, leerId(req));
      res.json({ configuracion });
    },

    fijarDiasDeArea: async (req, res) => {
      const { diasVacaciones } = req.body as DiasVacacionesEntrada;
      const configuracion = await servicio.fijarDeArea(obtenerActor(req), leerId(req), diasVacaciones);
      res.json({ configuracion });
    },

    obtenerDiasDePersona: async (req, res) => {
      const configuracion = await servicio.obtenerDePersona(obtenerActor(req).empresaId, leerId(req));
      res.json({ configuracion });
    },

    fijarDiasDePersona: async (req, res) => {
      const { diasVacaciones } = req.body as DiasVacacionesEntrada;
      const configuracion = await servicio.fijarDePersona(obtenerActor(req), leerId(req), diasVacaciones);
      res.json({ configuracion });
    },
  };
}