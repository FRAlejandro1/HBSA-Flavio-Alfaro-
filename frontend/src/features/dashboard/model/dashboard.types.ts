import type { UsuarioAutenticado } from '@/features/auth/auth.types';

export type EstadoSolicitud =
  | 'PENDIENTE'
  | 'VISTO_BUENO'
  | 'AUTORIZADA'
  | 'NEGADA'
  | 'CANCELADA';

export type TipoSolicitud = 'PROGRAMADA' | 'NO_PROGRAMADA';

export type TipoAprobador =
  | 'JEFE_INMEDIATO'
  | 'JEFE_AREA'
  | 'AUTORIDAD_MAXIMA'
  | 'SUPERADMIN';

export type EstadoPaso =
  | 'PENDIENTE'
  | 'APROBADO'
  | 'NEGADO'
  | 'ESCALADO'
  | 'CANCELADO';

export type OrigenPaso =
  | 'RUTA'
  | 'ESCALAMIENTO_MANUAL'
  | 'ESCALAMIENTO_PLAZO';

export interface PersonaResumen {
  id: number;
  nombres: string;
  apellidos: string;
}

export interface Solicitud {
  id: number;
  ordenTramite: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: number;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  solicitadoAt: string;
}

export interface PasoAprobacion {
  id: number;
  orden: number;
  tipoAprobador: TipoAprobador;
  origen: OrigenPaso;
  estado: EstadoPaso;
  aprobador: PersonaResumen;
  aprobadorDisponible: boolean;
  decididoPor: PersonaResumen | null;
  motivo: string | null;
  asignadoAt: string;
  venceAt: string | null;
  decididoAt: string | null;
}

export interface SolicitudDetalle extends Solicitud {
  solicitante: PersonaResumen & {
    cedula: string;
  };
  area: {
    id: number;
    detalle: string;
  };
  cargo: {
    id: number;
    detalle: string;
  };
  lugar: string;
  telefonoLocalizacion: string | null;
  fechaSolicitud: string;
  justificacion: string | null;
  motivoResolucion: string | null;
  fechaResolucion: string | null;
  pasos: PasoAprobacion[];
}

export interface RespuestaSolicitudDetalle {
  solicitud: SolicitudDetalle;
}

export interface RespuestaSolicitudes {
  solicitudes: Solicitud[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface DashboardProps {
  usuario: UsuarioAutenticado;
  onLogout: () => void;
  tema: string;
  cambiarTema: () => void;
  anunciar: (mensaje: string) => void;
}