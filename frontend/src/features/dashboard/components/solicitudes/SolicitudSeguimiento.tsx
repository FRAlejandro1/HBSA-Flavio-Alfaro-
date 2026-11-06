/**
 * Coordina el seguimiento de una solicitud seleccionada.
 * Presenta su estado, resumen y cronología de aprobación.
 */
import { useId } from 'react';
import { ESTADOS_SOLICITUD } from '@/features/dashboard/model/dashboard.constants';
import type { SolicitudDetalle } from '@/features/dashboard/model/dashboard.types';
import { SolicitudRutaAprobacion } from '@/features/dashboard/components/solicitudes/SolicitudRutaAprobacion';
import { SolicitudResumen } from '@/features/dashboard/components/solicitudes/SolicitudResumen';
import { armarItems } from '@/features/dashboard/components/solicitudes/solicitudSeguimiento.utils';

interface Props {
  solicitud: SolicitudDetalle | null;
  cargando: boolean;
  error: string;
  reintentar: () => void;
  anunciar?: (mensaje: string) => void;
}

export function SolicitudSeguimiento({
  solicitud,
  cargando,
  error,
  reintentar,
  anunciar,
}: Props) {
  const identificador = useId();
  const items = solicitud ? armarItems(solicitud) : [];

  return (
    <article
      className="panel tracking-panel"
      aria-labelledby={`${identificador}-title`}
    >
      <div className="tracking-heading">
        <div>
          <p className="panel-kicker">INFORMACIÓN DEL TRÁMITE</p>
          <h2 id={`${identificador}-title`}>Seguimiento de la solicitud elegida</h2>
        </div>

        {solicitud && (
          <span
            className={`status-chip status-${solicitud.estado.toLowerCase()}`}
          >
            {ESTADOS_SOLICITUD[solicitud.estado]}
          </span>
        )}
      </div>

      {cargando && (
        <div className="empty-state" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Cargando detalle y aprobaciones…</p>
        </div>
      )}

      {!cargando && error && (
        <div className="tracking-message tracking-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={reintentar}
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && !solicitud && (
        <div className="empty-state tracking-empty">
          <div className="empty-icon" aria-hidden="true">
            ◷
          </div>
          <strong>Seleccione una solicitud</strong>
          <p>
            Elija una solicitud de la sección «Mis solicitudes» para consultar
            la fecha de envío, la ruta de aprobación y el estado de cada paso.
          </p>
        </div>
      )}

      {!cargando && !error && solicitud && (
        <>
          <div className="tracking-layout">
            <SolicitudResumen solicitud={solicitud} anunciar={anunciar} />

            <SolicitudRutaAprobacion items={items} solicitudId={solicitud.id} />
          </div>

          {solicitud.estado === 'AUTORIZADA' && (
            <div className="tracking-document-note">
              <strong>Registro documental posterior</strong>
              <p>
                Después de la autorización, Talento Humano recibe el documento
                para su registro. El estado de ese registro no está disponible
                en los datos consultados y no se presenta como completado.
              </p>
            </div>
          )}
        </>
      )}
    </article>
  );
}