// Traduce HTTP a llamadas del service. El hospital sale siempre del token (obtenerEmpresaId),
// nunca del cuerpo, la query o la URL. Sin reglas de negocio.
import type { RequestHandler } from 'express';
import { obtenerEmpresaId } from '../../middlewares/multitenant';
import { exigirUsuario, leerIdParametro } from '../../shared/http/peticion';
import type { UsuariosService } from './usuarios.service';
import type {
  ActualizarUsuarioEntrada,
  BajaEntrada,
  CrearUsuarioEntrada,
  FiltrosUsuariosEntrada,
} from './usuarios.validators';

export interface UsuariosController {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  actualizar: RequestHandler;
  darDeBaja: RequestHandler;
  reactivar: RequestHandler;
}

export function crearUsuariosController(servicio: UsuariosService): UsuariosController {
  return {
    listar: async (req, res) => {
      const filtros = req.query as unknown as FiltrosUsuariosEntrada;
      res.json(await servicio.listar(obtenerEmpresaId(req), filtros));
    },

    obtener: async (req, res) => {
      res.json({ usuario: await servicio.obtener(obtenerEmpresaId(req), leerIdParametro(req)) });
    },

    crear: async (req, res) => {
      const usuario = await servicio.crear(exigirUsuario(req), req.body as CrearUsuarioEntrada);
      res.status(201).json({ usuario });
    },

    actualizar: async (req, res) => {
      const usuario = await servicio.actualizar(
        exigirUsuario(req),
        leerIdParametro(req),
        req.body as ActualizarUsuarioEntrada,
      );
      res.json({ usuario });
    },

    darDeBaja: async (req, res) => {
      const { fechaBaja } = req.body as BajaEntrada;
      const usuario = await servicio.darDeBaja(exigirUsuario(req), leerIdParametro(req), fechaBaja);
      res.json({ usuario });
    },

    reactivar: async (req, res) => {
      const usuario = await servicio.reactivar(exigirUsuario(req), leerIdParametro(req));
      res.json({ usuario });
    },
  };
}