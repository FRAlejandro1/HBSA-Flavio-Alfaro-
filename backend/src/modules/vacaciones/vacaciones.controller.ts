// Traduce HTTP a llamadas del service. La persona y su hospital salen siempre del token (req.usuario),
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
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

export function crearVacacionesController(servicio: VacacionesService): VacacionesController {
  return {
    crearSolicitud: async (req, res) => {
      const solicitud = await servicio.crear(obtenerActor(req), req.body as CrearSolicitudEntrada);
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
      const solicitud = await servicio.aprobar(obtenerActor(req), leerId(req), req.body as DecisionEntrada);
      res.json({ solicitud });
    },

    negarSolicitud: async (req, res) => {
      const solicitud = await servicio.negar(obtenerActor(req), leerId(req), req.body as DecisionEntrada);
      res.json({ solicitud });
    },

    cancelarSolicitud: async (req, res) => {
      const solicitud = await servicio.cancelar(obtenerActor(req), leerId(req), req.body as DecisionEntrada);
      res.json({ solicitud });
    },
  };
}