/**
 * Construye los elementos de la cronología de una solicitud.
 * Centraliza los mensajes, marcadores y detalles de cada etapa de aprobación.
 */
import type {
  EstadoPaso,
  PasoAprobacion,
  SolicitudDetalle,
  TipoAprobador,
} from '@/features/dashboard/model/dashboard.types';
import type { ItemSeguimiento } from '@/features/dashboard/components/solicitudes/SolicitudRutaAprobacion';
import { fechaHoraLegible } from '@/features/dashboard/model/dashboard.utils';

const NOMBRES_APROBADORES: Record<TipoAprobador, string> = {
  JEFE_INMEDIATO: 'Jefe inmediato',
  JEFE_AREA: 'Jefe de área',
  DIRECTOR: 'Director',
  SUPERADMIN: 'Superadministrador',
};

const QUIEN_DECIDE: Record<TipoAprobador, string> = {
  JEFE_INMEDIATO: 'su jefe inmediato',
  JEFE_AREA: 'el jefe de área',
  DIRECTOR: 'el Director',
  SUPERADMIN: 'el superadministrador',
};

const NOMBRES_ESTADOS_PASO: Record<EstadoPaso, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  NEGADO: 'Negado',
  ESCALADO: 'Escalado',
  CANCELADO: 'Cancelado',
};


/**
 * Obtiene el nombre completo de una persona responsable.
 */
function nombrePersona(
  persona: { nombres: string; apellidos: string } | null,
): string {
  if (!persona) {
    return 'Sin responsable registrado';
  }

  return `${persona.nombres} ${persona.apellidos}`.trim();
}

/**
 * Genera la clase visual correspondiente al estado del paso.
 */
function estadoPasoClase(estado: EstadoPaso): string {
  return `timeline-status timeline-status-${estado.toLowerCase()}`;
}

/**
 * Genera el mensaje breve que identifica cada paso.
 */
function mensajeCortoPaso(paso: PasoAprobacion): string {
  const quien = QUIEN_DECIDE[paso.tipoAprobador];

  switch (paso.estado) {
    case 'APROBADO':
      return `Aprobada por ${quien}`;
    case 'NEGADO':
      return `Negada por ${quien}`;
    case 'ESCALADO':
      return `Escalada desde ${quien}`;
    case 'CANCELADO':
      return `Cancelada en el paso de ${quien}`;
    case 'PENDIENTE':
      return `Recibida por ${quien}`;
  }
}

/**
 * Obtiene el marcador visual según el estado del paso.
 */
function marcadorPaso(paso: PasoAprobacion): string {
  switch (paso.estado) {
    case 'APROBADO':
      return '✓';
    case 'NEGADO':
      return '×';
    case 'ESCALADO':
      return '↗';
    case 'CANCELADO':
      return '−';
    case 'PENDIENTE':
      return String(paso.orden);
  }
}

/**
 * Presenta los datos completos de un paso de aprobación.
 */
function DetallePaso({ paso }: { paso: PasoAprobacion }) {
  return (
    <>
      <p>
        {NOMBRES_APROBADORES[paso.tipoAprobador]} · Paso {paso.orden}
      </p>

      <p>Responsable asignado: {nombrePersona(paso.aprobador)}</p>

      {(paso.estado === 'APROBADO' || paso.estado === 'NEGADO') && (
        <p>Decisión registrada por: {nombrePersona(paso.decididoPor)}</p>
      )}

      {paso.motivo && <p className="tracking-reason">Motivo: {paso.motivo}</p>}

      <span className="tracking-date">
        Asignado: {fechaHoraLegible(paso.asignadoAt)}
      </span>

      {paso.decididoAt && (
        <span className="tracking-date">
          Decisión: {fechaHoraLegible(paso.decididoAt)}
        </span>
      )}

      {paso.estado === 'PENDIENTE' && paso.venceAt && (
        <span className="tracking-date">
          Plazo de respuesta: {fechaHoraLegible(paso.venceAt)}
        </span>
      )}

      {paso.origen !== 'RUTA' && (
        <span className="tracking-origin">
          {paso.origen === 'ESCALAMIENTO_MANUAL'
            ? 'Paso generado por escalamiento manual'
            : 'Paso generado por vencimiento del plazo'}
        </span>
      )}

      {!paso.aprobadorDisponible && paso.estado === 'PENDIENTE' && (
        <p className="tracking-note">
          El responsable asignado figura como no disponible.
        </p>
      )}
    </>
  );
}

/**
 * Arma la cronología completa: envío, pasos de aprobación y resolución final.
 */
export function armarItems(solicitud: SolicitudDetalle): ItemSeguimiento[] {
  const items: ItemSeguimiento[] = [
    {
      clave: 'enviada',
      clase: 'tracking-step-complete',
      marcador: '✓',
      mensaje: 'Solicitud enviada',
      chip: {
        texto: 'Registrada',
        clase: 'timeline-status timeline-status-aprobado',
      },
      detalle: (
        <>
          <p>El sistema registró la solicitud {solicitud.ordenTramite}.</p>
          <span className="tracking-date">
            {fechaHoraLegible(solicitud.solicitadoAt)}
          </span>
        </>
      ),
    },
  ];

  const pasosOrdenados = [...solicitud.pasos].sort(
    (a, b) => a.orden - b.orden,
  );

  for (const paso of pasosOrdenados) {
    items.push({
      clave: `paso-${paso.id}`,
      clase: `tracking-step-${paso.estado.toLowerCase()}`,
      marcador: marcadorPaso(paso),
      mensaje: mensajeCortoPaso(paso),
      chip: {
        texto: NOMBRES_ESTADOS_PASO[paso.estado],
        clase: estadoPasoClase(paso.estado),
      },
      detalle: <DetallePaso paso={paso} />,
    });
  }

  if (solicitud.estado === 'AUTORIZADA') {
    items.push({
      clave: 'final',
      clase: 'tracking-step-complete',
      marcador: '✓',
      mensaje: 'Solicitud autorizada',
      chip: {
        texto: 'Autorizada',
        clase: 'timeline-status timeline-status-aprobado',
      },
      detalle: (
        <>
          <p>El estado del servidor confirma la autorización final.</p>
          {solicitud.fechaResolucion && (
            <span className="tracking-date">
              Resolución: {fechaHoraLegible(solicitud.fechaResolucion)}
            </span>
          )}
        </>
      ),
    });
  }

  if (solicitud.estado === 'NEGADA') {
    items.push({
      clave: 'final',
      clase: 'tracking-step-negado',
      marcador: '×',
      mensaje: 'Solicitud negada',
      chip: {
        texto: 'Negada',
        clase: 'timeline-status timeline-status-negado',
      },
      detalle: (
        <>
          {solicitud.motivoResolucion && (
            <p className="tracking-reason">
              Motivo: {solicitud.motivoResolucion}
            </p>
          )}
          {solicitud.fechaResolucion && (
            <span className="tracking-date">
              Resolución: {fechaHoraLegible(solicitud.fechaResolucion)}
            </span>
          )}
        </>
      ),
    });
  }

  if (solicitud.estado === 'CANCELADA') {
    items.push({
      clave: 'final',
      clase: 'tracking-step-cancelado',
      marcador: '−',
      mensaje: 'Solicitud cancelada',
      chip: {
        texto: 'Cancelada',
        clase: 'timeline-status timeline-status-cancelado',
      },
      detalle: (
        <>
          <p>La solicitud figura como cancelada en el servidor.</p>
          {solicitud.fechaResolucion && (
            <span className="tracking-date">
              Resolución: {fechaHoraLegible(solicitud.fechaResolucion)}
            </span>
          )}
        </>
      ),
    });
  }

  return items;
}