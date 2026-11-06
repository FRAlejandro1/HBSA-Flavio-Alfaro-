
// Traduce HTTP a llamadas del service. El hospital sale siempre del token (obtenerEmpresaId),
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { RequestHandler } from 'express';
import { obtenerEmpresaId } from '../../middlewares/multitenant';
import { exigirUsuario, leerIdParametro } from '../../shared/http/peticion';
import type { OrganizacionService } from './organizacion.service';
import type {
  ActualizarAreaEntrada,
  ActualizarCargoEntrada,
  ConfigurarDiasVacacionesAreaEntrada,
  CrearAreaEntrada,
  CrearCargoEntrada,
} from './organizacion.validators';

export interface OrganizacionController {
  listarProcesos: RequestHandler;
  listarAreas: RequestHandler;
  listarArbolAreas: RequestHandler;
  crearArea: RequestHandler;
  actualizarArea: RequestHandler;
  configurarDiasVacacionesArea: RequestHandler;
  eliminarArea: RequestHandler;
  listarCargos: RequestHandler;
  crearCargo: RequestHandler;
  actualizarCargo: RequestHandler;
  eliminarCargo: RequestHandler;
}

export function crearOrganizacionController(servicio: OrganizacionService): OrganizacionController {
  return {
    listarProcesos: async (_req, res) => {
      res.json({ procesos: await servicio.listarProcesos() });
    },

    listarAreas: async (req, res) => {
      res.json({ areas: await servicio.listarAreas(obtenerEmpresaId(req)) });
    },

    listarArbolAreas: async (req, res) => {
      res.json({ arbol: await servicio.listarArbol(obtenerEmpresaId(req)) });
    },

    crearArea: async (req, res) => {
      const area = await servicio.crearArea(obtenerEmpresaId(req), req.body as CrearAreaEntrada);
      res.status(201).json({ area });
    },

    actualizarArea: async (req, res) => {
      const area = await servicio.actualizarArea(
        obtenerEmpresaId(req),
        leerIdParametro(req),
        req.body as ActualizarAreaEntrada,
      );
      res.json({ area });
    },

    configurarDiasVacacionesArea: async (req, res) => {
      const area = await servicio.configurarDiasVacacionesArea(
        obtenerEmpresaId(req),
        exigirUsuario(req).id,
        leerIdParametro(req),
        (req.body as ConfigurarDiasVacacionesAreaEntrada).diasVacaciones,
      );
      res.json({ area });
    },

    eliminarArea: async (req, res) => {
      await servicio.eliminarArea(obtenerEmpresaId(req), leerIdParametro(req));
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
        leerIdParametro(req),
        req.body as ActualizarCargoEntrada,
      );
      res.json({ cargo });
    },

    eliminarCargo: async (req, res) => {
      await servicio.eliminarCargo(obtenerEmpresaId(req), leerIdParametro(req));
      res.status(204).end();
    },
  };
}
