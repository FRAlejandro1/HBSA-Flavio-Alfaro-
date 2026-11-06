/**
 * Pantalla de inicio propia del SUPERADMIN.
 * Mantiene el diseño común del sistema con composición independiente.
 */
import { DashboardAviso } from '@/features/dashboard/components/inicio/DashboardAviso';
import { DashboardModules } from '@/features/dashboard/components/inicio/DashboardModules';
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

export function SuperadminInicio({
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


      <div className="dashboard-section">
        <SolicitudSeguimiento
          solicitud={datos.detalleSolicitud}
          cargando={datos.cargandoDetalle}
          error={datos.errorDetalle}
          reintentar={datos.reintentarDetalle}
          anunciar={anunciar}
        />
      </div>

      <div className="dashboard-section">
        <DashboardModules
          onSolicitarVacaciones={onSolicitarVacaciones}
          anunciar={anunciar}
        />
      </div>

      <section className="dashboard-section" aria-label="Mis solicitudes">
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

