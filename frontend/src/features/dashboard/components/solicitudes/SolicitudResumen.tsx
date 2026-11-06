/**
 * Presenta el resumen de una solicitud seleccionada.
 * Incluye sus datos principales y la acción informativa del documento PDF.
 */
import { useId } from 'react';
import type { SolicitudDetalle } from '@/features/dashboard/model/dashboard.types';
import {
  fechaHoraLegible,
  fechaLegible,
} from '@/features/dashboard/model/dashboard.utils';

interface Props {
  solicitud: SolicitudDetalle;
  anunciar?: (mensaje: string) => void;
}

export function SolicitudResumen({ solicitud, anunciar }: Props) {
  const identificador = useId();

  return (
    <section
      className="tracking-details"
      aria-labelledby={`${identificador}-title`}
    >
      <h3 id={`${identificador}-title`}>Resumen de la solicitud</h3>

      <dl className="tracking-summary">
        <div>
          <dt className="tracking-label">Número de trámite</dt>
          <dd>
            <strong>{solicitud.ordenTramite}</strong>
          </dd>
        </div>

        <div>
          <dt className="tracking-label">Periodo solicitado</dt>
          <dd>
            <strong>
              {fechaLegible(solicitud.fechaInicio)} –{' '}
              {fechaLegible(solicitud.fechaFin)}
            </strong>
          </dd>
        </div>

        <div>
          <dt className="tracking-label">Días solicitados</dt>
          <dd>
            <strong>{solicitud.diasSolicitados}</strong>
          </dd>
        </div>

        <div>
          <dt className="tracking-label">Fecha de solicitud</dt>
          <dd>
            <strong>{fechaHoraLegible(solicitud.solicitadoAt)}</strong>
          </dd>
        </div>
      </dl>

      <button
        type="button"
        className="primary-button tracking-pdf-button"
        onClick={() =>
          anunciar?.(
            'La descarga del PDF está pendiente de integración con el servidor.',
          )
        }
      >
        Descargar PDF
      </button>

      <p className="tracking-pdf-note">
        La descarga estará disponible cuando se integre el servicio de
        generación del documento.
      </p>
    </section>
  );
}