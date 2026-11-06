import '@/features/dashboard/components/layout/layout.css';

interface Props {
  cerrarSesion: () => void;
  cerrando: boolean;
  anunciar: (mensaje: string) => void;
  // Aprobaciones solo debe verla quien aprueba; mientras no exista ese dato se muestra siempre
  mostrarAprobaciones?: boolean;
  pendientesAprobacion?: number;
  // Si no se indica, Inicio sube al comienzo de la página
  alIrAInicio?: (() => void) | undefined;
  // Solo para el SUPERADMIN: entrada a las pantallas de administración
  mostrarAdministracion?: boolean;
  alIrAAdministracion?: (() => void) | undefined;
  mostrarMisVacaciones?: boolean;
  alIrAMisVacaciones?: (() => void) | undefined;
  seccionActiva?: 'inicio' | 'administracion' | 'vacaciones';
}

export function DashboardSidebar({
  cerrarSesion,
  cerrando,
  anunciar,
  mostrarAprobaciones = true,
  pendientesAprobacion = 0,
  alIrAInicio,
  mostrarAdministracion = false,
  alIrAAdministracion,
  mostrarMisVacaciones = false,
  alIrAMisVacaciones,
  seccionActiva = 'inicio',
}: Props) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar-brand" title="Hospital Básico San Andrés">HB</div>
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item${seccionActiva === 'inicio' ? ' active' : ''}`}
          aria-current={seccionActiva === 'inicio' ? 'page' : undefined}
          onClick={() => {
            if (alIrAInicio) {
              alIrAInicio();
              return;
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="nav-icon" aria-hidden="true">⌂</span>
          <span>Inicio</span>
        </button>
        {mostrarAdministracion && (
          <button
            type="button"
            className={`nav-item${seccionActiva === 'administracion' ? ' active' : ''}`}
            aria-label="Administración"
            aria-current={seccionActiva === 'administracion' ? 'page' : undefined}
            onClick={() => alIrAAdministracion?.()}
          >
            <span className="nav-icon" aria-hidden="true">⚙</span>
            <span>Admin.</span>
          </button>
        )}
        {mostrarMisVacaciones && (
          <button
            type="button"
            className={`nav-item${seccionActiva === 'vacaciones' ? ' active' : ''}`}
            aria-label="Mis vacaciones"
            aria-current={seccionActiva === 'vacaciones' ? 'page' : undefined}
            onClick={() => alIrAMisVacaciones?.()}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            <span>Vacaciones</span>
          </button>
        )}
        {mostrarAprobaciones && (
          <button
            type="button"
            className="nav-item"
            aria-label={
              pendientesAprobacion > 0
                ? `Aprobaciones, ${pendientesAprobacion} pendientes`
                : undefined
            }
            onClick={() => anunciar('La bandeja de aprobaciones estará disponible próximamente.')}
          >
            <span className="nav-icon" aria-hidden="true">✓</span>
            <span>Aprob.</span>
            {pendientesAprobacion > 0 && (
              <span className="nav-badge" aria-hidden="true">
                {pendientesAprobacion}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          className="nav-item"
          onClick={() => anunciar('El calendario institucional estará disponible próximamente.')}
        >
          <span className="nav-icon" aria-hidden="true">▦</span>
          <span>Calend.</span>
        </button>
      </nav>
      <button
        type="button"
        className="nav-item nav-logout"
        onClick={cerrarSesion}
        disabled={cerrando}
      >
        <span className="nav-icon" aria-hidden="true">↪</span>
        <span>{cerrando ? 'Saliendo…' : 'Salir'}</span>
      </button>
    </aside>
  );
}

