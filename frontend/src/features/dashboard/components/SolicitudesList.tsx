import { ESTADOS_SOLICITUD } from '@/features/dashboard/dashboard.constants';
import type { Solicitud } from '@/features/dashboard/dashboard.types';
import { fechaLegible } from '@/features/dashboard/dashboard.utils';

interface Props {
  solicitudes: Solicitud[];
  cargando: boolean;
  anunciar: (mensaje: string) => void;
}

export function SolicitudesList({ solicitudes, cargando, anunciar }: Props) {
  if (cargando) {
    return (
      <div className="empty-state" role="status">
        <span className="spinner" aria-hidden="true" />
        <p>Cargando solicitudes…</p>
      </div>
    );
  }

  if (solicitudes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">▤</div>
        <strong>No hay solicitudes para mostrar</strong>
        <p>Cuando registre una solicitud, podrá consultar aquí su estado y fechas.</p>
      </div>
    );
  }

  return (
    <div className="request-list">
      {solicitudes.map((solicitud) => (
        <article className="request-row" key={solicitud.id}>
          <div className="request-symbol" aria-hidden="true">▤</div>
          <div className="request-info">
            <strong>Solicitud {solicitud.ordenTramite}</strong>
            <span>
              {fechaLegible(solicitud.fechaInicio)} – {fechaLegible(solicitud.fechaFin)}
              {' · '}{solicitud.diasSolicitados} días
            </span>
          </div>
          <span className={`status-chip status-${solicitud.estado.toLowerCase()}`}>
            {ESTADOS_SOLICITUD[solicitud.estado]}
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              anunciar(
                `El detalle de la solicitud ${solicitud.ordenTramite} se habilitará próximamente.`,
              )
            }
          >Ver detalle</button>
        </article>
      ))}
    </div>
  );
}
