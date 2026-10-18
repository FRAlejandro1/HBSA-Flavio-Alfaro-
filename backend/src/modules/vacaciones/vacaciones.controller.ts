// Traduce HTTP a llamadas del service. La persona y su hospital salen siempre del token (req.usuario),
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { RequestHandler } from 'express';
import { leerId, obtenerActor } from './vacaciones.controller.utils';
import type { FiltrosSolicitudes } from './vacaciones.dominio';
import type { VacacionesService } from './vacaciones.service';
import type {
  CrearSolicitudEntrada,
  DecisionEntrada,
  FiltrosSolicitudesEntrada,
} from './vacaciones.validators';

export interface VacacionesController {
  crearSolicitud: RequestHandler;
  listarMisSolicitudes: RequestHandler;
  obtenerSolicitud: RequestHandler;
  aprobarSolicitud: RequestHandler;
  negarSolicitud: RequestHandler;
  cancelarSolicitud: RequestHandler;
}

export function crearVacacionesController(
  servicio: VacacionesService,
): VacacionesController {
  return {
    crearSolicitud: async (req, res) => {
      const solicitud = await servicio.crear(
        obtenerActor(req),
        req.body as CrearSolicitudEntrada,
      );
      res.status(201).json({ solicitud });
    },

    listarMisSolicitudes: async (req, res) => {
      // validate dejo en req.query los valores ya convertidos
      const consulta = req.query as unknown as FiltrosSolicitudesEntrada;
      const filtros: FiltrosSolicitudes = {
        pagina: consulta.pagina,
        porPagina: consulta.porPagina,
        ...(consulta.estado !== undefined ? { estado: consulta.estado } : {}),
      };
      res.json(await servicio.listarPropias(obtenerActor(req), filtros));
    },

    obtenerSolicitud: async (req, res) => {
      const solicitud = await servicio.obtener(obtenerActor(req), leerId(req));
      res.json({ solicitud });
    },

    aprobarSolicitud: async (req, res) => {
      const solicitud = await servicio.aprobar(
        obtenerActor(req),
        leerId(req),
        req.body as DecisionEntrada,
      );
      res.json({ solicitud });
    },

    negarSolicitud: async (req, res) => {
      const solicitud = await servicio.negar(
        obtenerActor(req),
        leerId(req),
        req.body as DecisionEntrada,
      );
      res.json({ solicitud });
    },

    cancelarSolicitud: async (req, res) => {
      const solicitud = await servicio.cancelar(
        obtenerActor(req),
        leerId(req),
        req.body as DecisionEntrada,
      );
      res.json({ solicitud });
    },
  };
}