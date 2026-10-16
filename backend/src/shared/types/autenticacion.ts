// Datos del usuario que viajan en el token de acceso y que el middleware authenticate deja en req.usuario.
import type { CodigoRol } from './roles';

export interface UsuarioAutenticado {
  id: number;
  // Hospital al que pertenece: de aqui sale el filtro multitenant, nunca del body
  empresaId: number;
  rol: CodigoRol;
  // Identificador unico del token: permite revocarlo en Redis
  jti: string;
  // Instante de expiracion, en segundos desde 1970
  expira: number;
}