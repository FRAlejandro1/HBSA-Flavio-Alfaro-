interface Props {
  cerrarSesion: () => void;
  cerrando: boolean;
  anunciar: (mensaje: string) => void;
}

export function DashboardSidebar({ cerrarSesion, cerrando, anunciar }: Props) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar-brand" title="Hospital Básico San Andrés">HB</div>
      <nav className="sidebar-nav">
        <button
          type="button"
          className="nav-item active"
          aria-current="page"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <span className="nav-icon" aria-hidden="true">⌂</span>
          <span>Inicio</span>
        </button>
        <button
          type="button"
          className="nav-item"
          onClick={() => anunciar('La bandeja de aprobaciones estará disponible próximamente.')}
        >
          <span className="nav-icon" aria-hidden="true">✓</span>
          <span>Aprob.</span>
        </button>
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
