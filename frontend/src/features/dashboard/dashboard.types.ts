import type { UsuarioAutenticado } from '@/features/auth/auth.types';

export type EstadoSolicitud =
  | 'PENDIENTE'
  | 'VISTO_BUENO'
  | 'AUTORIZADA'
  | 'NEGADA'
  | 'CANCELADA';

export type TipoSolicitud = 'PROGRAMADA' | 'NO_PROGRAMADA';

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
