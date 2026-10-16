// Traduce HTTP a llamadas del service. El hospital sale siempre del token (obtenerEmpresaId),
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { Request, RequestHandler } from 'express';
import { obtenerEmpresaId } from '../../middlewares/multitenant';
import { AppError } from '../../shared/errors/AppError';
import type { OrganizacionService } from './organizacion.service';
import type {
  ActualizarAreaEntrada,
  ActualizarCargoEntrada,
  CrearAreaEntrada,
  CrearCargoEntrada,
} from './organizacion.validators';

export interface OrganizacionController {
  listarAreas: RequestHandler;
  crearArea: RequestHandler;
  actualizarArea: RequestHandler;
  eliminarArea: RequestHandler;
  listarCargos: RequestHandler;
  crearCargo: RequestHandler;
  actualizarCargo: RequestHandler;
  eliminarCargo: RequestHandler;
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

export function crearOrganizacionController(servicio: OrganizacionService): OrganizacionController {
  return {
    listarAreas: async (req, res) => {
      res.json({ areas: await servicio.listarAreas(obtenerEmpresaId(req)) });
    },

    crearArea: async (req, res) => {
      const area = await servicio.crearArea(obtenerEmpresaId(req), req.body as CrearAreaEntrada);
      res.status(201).json({ area });
    },

    actualizarArea: async (req, res) => {
      const area = await servicio.actualizarArea(
        obtenerEmpresaId(req),
        leerId(req),
        req.body as ActualizarAreaEntrada,
      );
      res.json({ area });
    },

    eliminarArea: async (req, res) => {
      await servicio.eliminarArea(obtenerEmpresaId(req), leerId(req));
      res.status(204).end();
    },

    listarCargos: async (req, res) => {
      res.json({ cargos: await servicio.listarCargos(obtenerEmpresaId(req)) });
    },

    crearCargo: async (req, res) => {
      const cargo = await servicio.crearCargo(obtenerEmpresaId(req), req.body as CrearCargoEntrada);
      res.status(201).json({ cargo });
    },

    actualizarCargo: async (req, res) => {
      const cargo = await servicio.actualizarCargo(
        obtenerEmpresaId(req),
        leerId(req),
        req.body as ActualizarCargoEntrada,
      );
      res.json({ cargo });
    },

    eliminarCargo: async (req, res) => {
      await servicio.eliminarCargo(obtenerEmpresaId(req), leerId(req));
      res.status(204).end();
    },
  };
}