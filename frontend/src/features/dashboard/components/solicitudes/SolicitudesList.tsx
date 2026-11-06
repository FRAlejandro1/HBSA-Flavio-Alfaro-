import {
  ESTADOS_SOLICITUD,
  TIPOS_SOLICITUD,
} from '@/features/dashboard/model/dashboard.constants';
import type { Solicitud } from '@/features/dashboard/model/dashboard.types';
import { fechaLegible } from '@/features/dashboard/model/dashboard.utils';

interface Props {
  solicitudes: Solicitud[];
  cargando: boolean;
  anunciar: (mensaje: string) => void;
  solicitudSeleccionadaId?: number | null;
  alSeleccionar?: (solicitud: Solicitud) => void;
}

function tiempoLegible(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

export function SolicitudesList({
  solicitudes,
  cargando,
  anunciar,
  solicitudSeleccionadaId = null,
  alSeleccionar,
}: Props) {
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
        <div className="empty-icon" aria-hidden="true">
          ▤
        </div>
        <strong>No hay solicitudes para mostrar</strong>
        <p>
          Cuando registre una solicitud, podrá consultar aquí su estado y
          fechas.
        </p>
      </div>
    );
  }

  return (
    <div
      className="solicitudes-tabla"
      role="table"
      aria-label="Mis solicitudes"
    >
      <div className="solicitudes-tabla-encabezado" role="row">
        <span role="columnheader">Orden</span>
        <span role="columnheader">Tipo</span>
        <span role="columnheader">Fechas</span>
        <span role="columnheader">Tiempo</span>
        <span role="columnheader">Estado</span>
      </div>

      {solicitudes.map((solicitud) => {
        const seleccionada = solicitud.id === solicitudSeleccionadaId;

        return (
          <div
            className={`solicitud-fila${seleccionada ? ' solicitud-fila-seleccionada' : ''}`}
            role="row"
            key={solicitud.id}
          >
            <div
              className="solicitud-celda solicitud-celda-orden"
              role="cell"
            >
              <button
                type="button"
                className="solicitud-boton"
                aria-pressed={seleccionada}
                aria-label={`Ver el seguimiento de la solicitud ${solicitud.ordenTramite}`}
                onClick={() => {
                  if (alSeleccionar) {
                    alSeleccionar(solicitud);
                    return;
                  }

                  anunciar(
                    `Seleccione el detalle de la solicitud ${solicitud.ordenTramite} desde el panel de seguimiento.`,
                  );
                }}
              >
                {solicitud.ordenTramite}
              </button>
            </div>

            <div
              className="solicitud-celda"
              role="cell"
              data-etiqueta="Tipo"
            >
              {TIPOS_SOLICITUD[solicitud.tipo]}
            </div>

            <div
              className="solicitud-celda"
              role="cell"
              data-etiqueta="Fechas"
            >
              {fechaLegible(solicitud.fechaInicio)} –{' '}
              {fechaLegible(solicitud.fechaFin)}
            </div>

            <div
              className="solicitud-celda"
              role="cell"
              data-etiqueta="Tiempo"
            >
              {tiempoLegible(solicitud.diasSolicitados)}
            </div>

            <div
              className="solicitud-celda solicitud-celda-estado"
              role="cell"
            >
              <span
                className={`status-chip status-${solicitud.estado.toLowerCase()}`}
              >
                {ESTADOS_SOLICITUD[solicitud.estado]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}