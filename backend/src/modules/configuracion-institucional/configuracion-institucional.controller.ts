// Controlador HTTP de configuracion institucional.
// Traduce las solicitudes HTTP a llamadas del servicio y obtiene el actor del token.

import type { RequestHandler } from 'express';
import { obtenerActor } from '../vacaciones/vacaciones.controller.utils';
import type { ConfiguracionInstitucionalService } from './configuracion-institucional.service';
import type { EntradaActualizarConfiguracionInstitucional } from './configuracion-institucional.validators';

export interface ConfiguracionInstitucionalController {
  obtener: RequestHandler;
  actualizar: RequestHandler;
}

export function crearConfiguracionInstitucionalController(
  servicio: ConfiguracionInstitucionalService,
): ConfiguracionInstitucionalController {
  return {
    obtener: async (req, res) => {
      const configuracion = await servicio.obtener(obtenerActor(req));
      res.json({ configuracion });
    },

    actualizar: async (req, res) => {
      const configuracion = await servicio.actualizar(
        obtenerActor(req),
        req.body as EntradaActualizarConfiguracionInstitucional,
      );
      res.json({ configuracion });
    },
  };
}