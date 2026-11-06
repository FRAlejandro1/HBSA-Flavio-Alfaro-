// Controlador HTTP de delegaciones.
// Obtiene la identidad del token y delega las reglas de negocio al servicio.

import type { RequestHandler } from 'express';
import { exigirUsuario, leerIdParametro } from '../../shared/http/peticion';
import type { DelegacionesService } from './delegaciones.service';
import type {
  CrearDelegacionEntrada,
  FiltrosDelegacionesEntrada,
} from './delegaciones.validators';

export interface DelegacionesController {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  revocar: RequestHandler;
}

export function crearDelegacionesController(
  servicio: DelegacionesService,
): DelegacionesController {
  return {
    listar: async (req, res) => {
      const filtros = req.query as unknown as FiltrosDelegacionesEntrada;
      const delegaciones = await servicio.listar(exigirUsuario(req), filtros);
      res.json(delegaciones);
    },

    obtener: async (req, res) => {
      const delegacion = await servicio.obtener(
        exigirUsuario(req),
        leerIdParametro(req),
      );
      res.json({ delegacion });
    },

    crear: async (req, res) => {
      const delegacion = await servicio.crear(
        exigirUsuario(req),
        req.body as CrearDelegacionEntrada,
      );
      res.status(201).json({ delegacion });
    },

    revocar: async (req, res) => {
      const delegacion = await servicio.revocar(
        exigirUsuario(req),
        leerIdParametro(req),
      );
      res.json({ delegacion });
    },
  };
}