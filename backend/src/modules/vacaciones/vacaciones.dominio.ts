// Tipos y constantes del dominio de vacaciones: solicitudes, pasos de aprobacion y sus estados.
// No dependen de Express ni de MySQL.

// Estados de la solicitud; VISTO_BUENO solo aparece si la ruta del hospital tiene mas de un paso
export type EstadoSolicitud = 'PENDIENTE' | 'VISTO_BUENO' | 'AUTORIZADA' | 'NEGADA' | 'CANCELADA';

// Estados en los que la solicitud sigue en tramite: aun se puede decidir o cancelar y sus dias estan reservados
export const ESTADOS_EN_TRAMITE: readonly EstadoSolicitud[] = ['PENDIENTE', 'VISTO_BUENO'];

// Programada si faltan 7 dias o mas desde la solicitud hasta el inicio; la base lo deriva igual
export type TipoSolicitud = 'PROGRAMADA' | 'NO_PROGRAMADA';

// Quien debe aprobar un paso de la ruta
export type TipoAprobador = 'JEFE_INMEDIATO' | 'JEFE_AREA' | 'AUTORIDAD_MAXIMA' | 'SUPERADMIN';

export type EstadoPaso = 'PENDIENTE' | 'APROBADO' | 'NEGADO' | 'ESCALADO' | 'CANCELADO';

// De donde viene un paso: de la ruta, o de un escalamiento (manual de Talento Humano o por plazo vencido)
export type OrigenPaso = 'RUTA' | 'ESCALAMIENTO_MANUAL' | 'ESCALAMIENTO_PLAZO';

// Que le avisa una notificacion a la persona que solicito
export type TipoNotificacion = 'SOLICITUD_APROBADA' | 'SOLICITUD_NEGADA';

// Dias de anticipacion desde los que una solicitud es programada (la regla vive en shared/utils/fechas)
export { DIAS_ANTICIPACION_PROGRAMADA } from '../../shared/utils/fechas';

// Mensajes de las reglas que el service avisa antes y el repository comprueba de nuevo dentro de la transaccion
export const MENSAJE_SOLAPAMIENTO = 'Ya tienes una solicitud de vacaciones en esas fechas';
export const MENSAJE_PASO_RESUELTO =
  'La solicitud ya fue resuelta o este paso ya no esta pendiente de tu decision';

export function mensajeSaldoInsuficiente(saldo: number, diasSolicitados: number): string {
  return `Tu saldo disponible es de ${String(saldo)} dias y solicitas ${String(diasSolicitados)}`;
}

export interface PersonaResumen {
  id: number;
  nombres: string;
  apellidos: string;
}

// Un paso de la ruta de aprobacion de una solicitud, con quien debe decidirlo y quien lo decidio
export interface PasoAprobacion {
  id: number;
  orden: number;
  tipoAprobador: TipoAprobador;
  origen: OrigenPaso;
  estado: EstadoPaso;
  aprobador: PersonaResumen;
  // false si el aprobador esta dado de baja o tiene vacaciones autorizadas hoy
  aprobadorDisponible: boolean;
  decididoPor: PersonaResumen | null;
  motivo: string | null;
  asignadoAt: Date;
  // Limite para responder; pasado ese instante la solicitud puede escalarse
  venceAt: Date | null;
  decididoAt: Date | null;
}

// Paso pendiente cuyo plazo de aprobacion ya vencio
export interface PasoVencido {
  empresaId: number;
  solicitudId: number;
  pasoId: number;
  orden: number;
  tipoAprobador: TipoAprobador;
  solicitanteId: number;
}

// Datos necesarios para escalar un paso vencido dentro de una transaccion
export interface DatosEscalamientoPlazo {
  solicitudId: number;
  pasoId: number;
  nuevoTipoAprobador: TipoAprobador;
  nuevoAprobadorId: number;
  nuevaOrden: number;
  escaladoAt: Date;
  nuevaVenceAt: Date;
  motivo: string;
}

// Solicitud completa, con sus pasos de aprobacion en orden
export interface SolicitudDetalle {
  id: number;
  ordenTramite: string;
  solicitante: PersonaResumen & { cedula: string };
  area: { id: number; detalle: string };
  cargo: { id: number; detalle: string };
  lugar: string;
  telefonoLocalizacion: string | null;
  solicitadoAt: Date;
  // Fecha de calendario de la solicitud en la zona del hospital (de ella sale si es programada)
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: number;
  justificacion: string | null;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  motivoResolucion: string | null;
  fechaResolucion: Date | null;
  pasos: PasoAprobacion[];
}

// Fila de las listas: lo necesario para mostrar la solicitud sin sus pasos
export interface SolicitudResumen {
  id: number;
  ordenTramite: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: number;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  solicitadoAt: Date;
}

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud;
  pagina: number;
  porPagina: number;
}

export interface PaginaSolicitudes {
  solicitudes: SolicitudResumen[];
  total: number;
  pagina: number;
  porPagina: number;
}

// Datos de la persona que solicita, los que el service necesita para validar y elegir la ruta
export interface Solicitante {
  id: number;
  areaId: number;
  cargoId: number;
  // cargos.nivel_jerarquico: define la ruta de aprobacion
  nivelJerarquico: number;
  telefono: string | null;
  jefeInmediatoId: number | null;
  estado: 'ACTIVO' | 'INACTIVO';
  // Lugar que se imprime en la solicitud (el de su hospital)
  lugar: string;
}

// Datos del primer paso que se crea junto con la solicitud
export interface DatosPrimerPaso {
  tipoAprobador: TipoAprobador;
  aprobadorId: number;
  asignadoAt: Date;
  venceAt: Date;
}

// Paso que se abre cuando el anterior se aprueba y la ruta tiene mas pasos
export interface DatosSiguientePaso extends DatosPrimerPaso {
  orden: number;
}

// Todo lo que se guarda al registrar una solicitud (la solicitud y su primer paso se guardan juntos)
export interface DatosNuevaSolicitud {
  usuarioId: number;
  areaId: number;
  cargoId: number;
  lugar: string;
  telefonoLocalizacion: string | null;
  solicitadoAt: Date;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: number;
  justificacion: string | null;
  primerPaso: DatosPrimerPaso;
}

// Aviso para la persona que solicito; el id de la solicitud lo pone el repository
export interface NotificacionNueva {
  usuarioId: number;
  tipo: TipoNotificacion;
  mensaje: string;
}

// Decision de quien debe aprobar el paso pendiente de una solicitud
export interface DatosDecision {
  solicitudId: number;
  pasoId: number;
  // Debe seguir siendo la persona asignada al paso cuando se guarda la decision
  aprobadorId: number;
  decididoAt: Date;
  motivo: string | null;
}

// Aprueba un paso que no es el ultimo: la solicitud queda en VISTO_BUENO y se abre el siguiente paso
export interface DatosAprobacionIntermedia extends DatosDecision {
  siguiente: DatosSiguientePaso;
}

// Aprueba el ultimo paso (autoriza) o niega: cierra la solicitud y avisa a quien la pidio
export interface DatosResolucionFinal extends DatosDecision {
  notificacion: NotificacionNueva;
}

// La persona cancela su propia solicitud mientras sigue en tramite
export interface DatosCancelacion {
  solicitudId: number;
  usuarioId: number;
  canceladaAt: Date;
  motivo: string | null;
}

/** Paso pendiente cuyo plazo de aprobación ya venció. */
export interface PasoVencido {
  empresaId: number;
  solicitudId: number;
  pasoId: number;
  orden: number;
  tipoAprobador: TipoAprobador;
  solicitanteId: number;
}

/** Datos necesarios para escalar un paso vencido dentro de una transacción. */
export interface DatosEscalamientoPlazo {
  solicitudId: number;
  pasoId: number;
  nuevoTipoAprobador: TipoAprobador;
  nuevoAprobadorId: number;
  nuevaOrden: number;
  escaladoAt: Date;
  nuevaVenceAt: Date;
  motivo: string;
}