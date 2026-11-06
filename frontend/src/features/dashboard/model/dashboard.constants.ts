import type { EstadoSolicitud, TipoSolicitud } from './dashboard.types';

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  VISTO_BUENO: 'En revisión',
  AUTORIZADA: 'Autorizada',
  NEGADA: 'Negada',
  CANCELADA: 'Cancelada',
};

// Mientras solo exista el módulo de vacaciones, el tipo se muestra con su modalidad
export const TIPOS_SOLICITUD: Record<TipoSolicitud, string> = {
  PROGRAMADA: 'Vacaciones · Programada',
  NO_PROGRAMADA: 'Vacaciones · No programada',
};

export const FILTROS_SOLICITUDES = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'PERMISOS', label: 'Permisos' },
  { value: 'LICENCIAS', label: 'Licencias' },
] as const;