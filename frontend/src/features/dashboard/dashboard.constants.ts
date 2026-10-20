import type { EstadoSolicitud } from './dashboard.types';

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  VISTO_BUENO: 'En revisión',
  AUTORIZADA: 'Autorizada',
  NEGADA: 'Negada',
  CANCELADA: 'Cancelada',
};

export const FILTROS_SOLICITUDES = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'PERMISOS', label: 'Permisos' },
  { value: 'LICENCIAS', label: 'Licencias' },
] as const;
