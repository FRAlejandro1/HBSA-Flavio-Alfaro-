/**
 * Inicio propio del SUPERADMIN.
 * Integra sus solicitudes personales de vacaciones sin reutilizar la página
 * de inicio del empleado ni mezclar las responsabilidades administrativas.
 */
import { DashboardAviso } from '@/features/dashboard/components/inicio/DashboardAviso';
import { SolicitudSeguimiento } from '@/features/dashboard/components/solicitudes/SolicitudSeguimiento';
import { SolicitudesList } from '@/features/dashboard/components/solicitudes/SolicitudesList';
import { SolicitudesSummary } from '@/features/dashboard/components/solicitudes/SolicitudesSummary';
import type { SolicitudesPropias } from '@/features/dashboard/hooks/useSolicitudesPropias';
import '@/features/dashboard/components/inicio/inicio.css';
import '@/features/dashboard/components/solicitudes/solicitudes.css';

interface Props {
  datos: SolicitudesPropias;
  onSolicitarVacaciones: () => void;
  anunciar: (mensaje: string) => void;
}

/**
 * Presenta el seguimiento y el historial personal de vacaciones
 * del SUPERADMIN, además del acceso para crear una solicitud.
 */
export function SuperadminVacaciones({
  datos,
  onSolicitarVacaciones,
  anunciar,
}: Props) {
  return (
    <>
      <DashboardAviso aviso={null} alVerDetalles={datos.verDetalleAviso} />

      {datos.error && (
        <div
          className="feedback feedback-error dashboard-feedback"
          role="alert"
        >
          <span>{datos.error}</span>
          <button
            type="button"
            onClick={() => void datos.cargarSolicitudes()}
          >
            Reintentar
          </button>
        </div>
      )}

      <section className="dashboard-section" aria-label="Mis vacaciones">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Mis vacaciones</h2>
              <p>Consulta tus solicitudes personales y registra nuevas solicitudes.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSolicitarVacaciones}
            >
              Solicitar vacaciones
            </button>
          </div>
        </article>
      </section>

      <div className="dashboard-section">
        <SolicitudSeguimiento
          solicitud={datos.detalleSolicitud}
          cargando={datos.cargandoDetalle}
          error={datos.errorDetalle}
          reintentar={datos.reintentarDetalle}
          anunciar={anunciar}
        />
      </div>

      <section className="dashboard-section" aria-label="Historial de mis solicitudes">
        <article className="panel requests-panel">
          <SolicitudesSummary
            total={datos.total}
            filtro={datos.filtro}
            cambiarFiltro={datos.setFiltro}
            anunciar={anunciar}
          />

          <SolicitudesList
            solicitudes={datos.solicitudesFiltradas}
            cargando={datos.cargando}
            anunciar={anunciar}
            solicitudSeleccionadaId={datos.solicitudSeleccionadaId}
            alSeleccionar={datos.seleccionarSolicitud}
          />
        </article>
      </section>
    </>
  );
}

