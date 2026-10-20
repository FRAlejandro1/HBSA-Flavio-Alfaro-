import { useCallback, useEffect, useState } from 'react';
import { cerrarSesion } from '@/features/auth/auth.api';
import { AccessibilityTools } from '@/features/dashboard/components/AccessibilityTools';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { DashboardModules } from '@/features/dashboard/components/DashboardModules';
import { DashboardSidebar } from '@/features/dashboard/components/DashboardSidebar';
import { DashboardWelcome } from '@/features/dashboard/components/DashboardWelcome';
import { SolicitudesList } from '@/features/dashboard/components/SolicitudesList';
import { SolicitudesSummary } from '@/features/dashboard/components/SolicitudesSummary';
import { listarSolicitudes } from '@/features/dashboard/dashboard.api';
import type {
  DashboardProps,
  Solicitud,
} from '@/features/dashboard/dashboard.types';
import { SolicitudVacacionesForm } from '@/features/dashboard/SolicitudVacacionesForm';

export function DashboardPage({
  usuario,
  onLogout,
  tema,
  cambiarTema,
  anunciar,
}: DashboardProps) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('TODAS');
  const [cerrando, setCerrando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const respuesta = await listarSolicitudes();
      setSolicitudes(respuesta.solicitudes);
      setTotal(respuesta.total);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : 'No se pudieron cargar las solicitudes.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  async function salir() {
    setCerrando(true);

    try {
      await cerrarSesion();
    } catch {
      anunciar(
        'No se pudo confirmar el cierre de sesión con el servidor.',
      );
    } finally {
      onLogout();
      setCerrando(false);
    }
  }

  const solicitudesFiltradas =
    filtro === 'TODAS' || filtro === 'VACACIONES' ? solicitudes : [];

  return (
    <div className="app-layout">
      <DashboardSidebar
        cerrarSesion={() => void salir()}
        cerrando={cerrando}
        anunciar={anunciar}
      />

      <main className="dashboard-main">
        <DashboardHeader
          usuario={usuario}
          tema={tema}
          cambiarTema={cambiarTema}
          anunciar={anunciar}
        />

        <DashboardWelcome usuario={usuario} />

        {error && (
          <div
            className="feedback feedback-error dashboard-feedback"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void cargarSolicitudes()}
            >
              Reintentar
            </button>
          </div>
        )}

        <section
          className="dashboard-grid"
          aria-label="Módulos del sistema"
        >
          <DashboardModules
            onSolicitarVacaciones={() => setMostrarFormulario(true)}
            anunciar={anunciar}
          />

          <article className="panel panel-wide">
            <SolicitudesSummary
              total={total}
              filtro={filtro}
              cambiarFiltro={setFiltro}
              anunciar={anunciar}
            />

            <SolicitudesList
              solicitudes={solicitudesFiltradas}
              cargando={cargando}
              anunciar={anunciar}
            />
          </article>
        </section>

        {mostrarFormulario && (
          <SolicitudVacacionesForm
            onCancel={() => setMostrarFormulario(false)}
            onCreated={async () => {
              setMostrarFormulario(false);
              anunciar(
                'La solicitud de vacaciones se registró correctamente.',
              );
              await cargarSolicitudes();
            }}
          />
        )}

        <footer className="dashboard-footer">
          <span>Hospital Básico San Andrés · Flavio Alfaro</span>
          <span>{usuario.area.detalle || 'Área no especificada'}</span>
        </footer>
      </main>

      <AccessibilityTools anunciar={anunciar} />
    </div>
  );
}