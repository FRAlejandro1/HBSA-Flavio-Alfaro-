// Traduce HTTP a llamadas del servicio de jornadas.
// El actor y su hospital se obtienen siempre del token de autenticación.

import type { RequestHandler } from 'express';
import { leerId, obtenerActor } from '../vacaciones/vacaciones.controller.utils';
import type { JornadasService } from './jornadas.service';
import type {
  ActualizarTurnoEntrada,
  CrearAsignacionEntrada,
  CrearPatronEntrada,
  CrearTurnoEntrada,
  CerrarAsignacionEntrada,
  ConsultarJornadaEntrada,
  ListarJornadasEntrada,
} from './jornadas.validators';

export interface JornadasController {
  listarTurnos: RequestHandler;
  obtenerTurno: RequestHandler;
  crearTurno: RequestHandler;
  actualizarTurno: RequestHandler;
  listarPatrones: RequestHandler;
  obtenerPatron: RequestHandler;
  crearPatron: RequestHandler;
  crearAsignacion: RequestHandler;
  cerrarAsignacion: RequestHandler;
  consultarJornada: RequestHandler;
}

export function crearJornadasController(
  servicio: JornadasService,
): JornadasController {
  return {
    listarTurnos: async (req, res) => {
      const consulta = req.query as unknown as ListarJornadasEntrada;
      const turnos = await servicio.listarTurnos(
        obtenerActor(req),
        consulta.incluirInactivos ?? false,
      );
      res.json({ turnos });
    },

    obtenerTurno: async (req, res) => {
      const turno = await servicio.obtenerTurno(obtenerActor(req), leerId(req));
      res.json({ turno });
    },

    crearTurno: async (req, res) => {
      const turno = await servicio.crearTurno(
        obtenerActor(req),
        req.body as CrearTurnoEntrada,
      );
      res.status(201).json({ turno });
    },

    actualizarTurno: async (req, res) => {
      const turno = await servicio.actualizarTurno(
        obtenerActor(req),
        leerId(req),
        req.body as ActualizarTurnoEntrada,
      );
      res.json({ turno });
    },

    listarPatrones: async (req, res) => {
      const consulta = req.query as unknown as ListarJornadasEntrada;
      const patrones = await servicio.listarPatrones(
        obtenerActor(req),
        consulta.incluirInactivos ?? false,
      );
      res.json({ patrones });
    },

    obtenerPatron: async (req, res) => {
      const patron = await servicio.obtenerPatron(obtenerActor(req), leerId(req));
      res.json({ patron });
    },

    crearPatron: async (req, res) => {
      const patron = await servicio.crearPatron(
        obtenerActor(req),
        req.body as CrearPatronEntrada,
      );
      res.status(201).json({ patron });
    },

    crearAsignacion: async (req, res) => {
      const asignacion = await servicio.crearAsignacion(
        obtenerActor(req),
        req.body as CrearAsignacionEntrada,
      );
      res.status(201).json({ asignacion });
    },

    cerrarAsignacion: async (req, res) => {
      const asignacion = await servicio.cerrarAsignacion(
        obtenerActor(req),
        req.body as CerrarAsignacionEntrada,
      );
      res.json({ asignacion });
    },

    consultarJornada: async (req, res) => {
      const consulta = req.query as unknown as ConsultarJornadaEntrada;
      const jornada = await servicio.obtenerJornadaParaFecha(
        obtenerActor(req),
        consulta.usuarioId,
        consulta.fecha,
      );
      res.json({ jornada });
    },
  };
}
