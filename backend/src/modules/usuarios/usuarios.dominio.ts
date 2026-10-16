// Tipos y reglas de permisos del dominio de usuarios. No dependen de Express ni de MySQL.
import { ROLES } from '../../shared/types/roles';
import type { CodigoRol } from '../../shared/types/roles';

export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

// Persona de la plantilla, tal como se muestra en listas y detalle (nunca incluye claves ni tokens)
export interface UsuarioDetalle {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  rol: CodigoRol;
  area: { id: number; detalle: string };
  cargo: { id: number; detalle: string };
  jefeInmediato: { id: number; nombres: string; apellidos: string } | null;
  fechaIngreso: string;
  estado: EstadoUsuario;
  fechaBaja: string | null;
  // true si la persona puede iniciar sesion (tiene correo y clave)
  tieneCuenta: boolean;
}

export interface FiltrosUsuarios {
  busqueda?: string;
  areaId?: number;
  estado?: EstadoUsuario;
  pagina: number;
  porPagina: number;
}

export interface PaginaUsuarios {
  usuarios: UsuarioDetalle[];
  total: number;
  pagina: number;
  porPagina: number;
}

// Datos para crear una persona; la clave ya llega hasheada
export interface DatosNuevoUsuario {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  areaId: number;
  cargoId: number;
  rol: CodigoRol;
  jefeInmediatoId: number | null;
  fechaIngreso: string;
  passwordHash: string | null;
}

// En una actualizacion solo viajan los campos que cambian; null quita el valor cuando aplica
export interface CambiosUsuario {
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  correo?: string | null;
  telefono?: string | null;
  areaId?: number;
  cargoId?: number;
  rol?: CodigoRol;
  jefeInmediatoId?: number | null;
  fechaIngreso?: string;
  passwordHash?: string | null;
  // Borra el refresh token vigente: la persona debe volver a iniciar sesion
  cerrarSesion?: boolean;
}

// Roles que cada rol puede asignar y, por lo mismo, a quienes puede gestionar
export const ROLES_ASIGNABLES: Record<CodigoRol, readonly CodigoRol[]> = {
  SUPERADMIN: ROLES,
  TALENTO_HUMANO: ['JEFE_AREA', 'EMPLEADO'],
  JEFE_AREA: [],
  EMPLEADO: [],
};