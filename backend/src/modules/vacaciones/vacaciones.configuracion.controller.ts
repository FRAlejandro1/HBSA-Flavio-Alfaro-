// Traduce HTTP a llamadas del service de configuracion. El hospital y quien cambia salen siempre del token,
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { RequestHandler } from 'express';
import type { DiasVacacionesEntrada } from './vacaciones.configuracion.validators';
import type { PeriodosService } from './vacaciones.periodos.service';
import { leerId, obtenerActor } from './vacaciones.controller.utils';

export interface ConfiguracionVacacionesController {
  obtenerDiasDeArea: RequestHandler;
  fijarDiasDeArea: RequestHandler;
  obtenerDiasDePersona: RequestHandler;
  fijarDiasDePersona: RequestHandler;
}

export function crearConfiguracionVacacionesController(
  servicio: PeriodosService,
): ConfiguracionVacacionesController {
  return {
    obtenerDiasDeArea: async (req, res) => {
      const configuracion = await servicio.obtenerDeArea(
        obtenerActor(req).empresaId,
        leerId(req),
      );
      res.json({ configuracion });
    },

    fijarDiasDeArea: async (req, res) => {
      const { diasVacaciones } = req.body as DiasVacacionesEntrada;
      const configuracion = await servicio.fijarDeArea(
        obtenerActor(req),
        leerId(req),
        diasVacaciones,
      );
      res.json({ configuracion });
    },

    obtenerDiasDePersona: async (req, res) => {
      const configuracion = await servicio.obtenerDePersona(
        obtenerActor(req).empresaId,
        leerId(req),
      );
      res.json({ configuracion });
    },

    fijarDiasDePersona: async (req, res) => {
      const { diasVacaciones } = req.body as DiasVacacionesEntrada;
      const configuracion = await servicio.fijarDePersona(
        obtenerActor(req),
        leerId(req),
        diasVacaciones,
      );
      res.json({ configuracion });
    },
  };
}