// Tipos y constantes del dominio de autenticacion. No dependen de Express ni de la base de datos.
import type { CodigoRol } from '../../shared/types/roles';

// Mismo mensaje para correo inexistente, clave incorrecta o cuenta inactiva: no revela cual fue
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o clave incorrectos';

// Datos necesarios para verificar una clave
export interface CredencialesUsuario {
  id: number;
  empresaId: number;
  // Null si el usuario esta en la plantilla pero no tiene cuenta para iniciar sesion
  passwordHash: string | null;
  rol: CodigoRol;
}

// Datos minimos para emitir tokens de un usuario activo
export interface SesionUsuario {
  id: number;
  empresaId: number;
  rol: CodigoRol;
}

// Perfil que recibe el frontend al iniciar sesion y en GET /me
export interface PerfilUsuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string | null;
  rol: CodigoRol;
  empresa: { id: number; nombre: string };
  area: { id: number; detalle: string };
  cargo: { id: number; detalle: string };
}

export interface ResultadoLogin {
  accessToken: string;
  refreshToken: string;
  // Segundos de vida del access token
  expiraEn: number;
  usuario: PerfilUsuario;
}

export interface ResultadoRefresco {
  accessToken: string;
  refreshToken: string;
  expiraEn: number;
}