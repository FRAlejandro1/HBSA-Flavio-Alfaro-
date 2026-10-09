// Amplia la peticion de Express con los datos que agregan los middlewares de autenticacion.
import type { UsuarioAutenticado } from './autenticacion';

declare global {
  namespace Express {
    interface Request {
      // Lo deja authenticate cuando el token de acceso es valido
      usuario?: UsuarioAutenticado;
      // Lo deja multitenant: hospital sobre el que se filtran todas las consultas
      empresaId?: number;
    }
  }
}

export {};