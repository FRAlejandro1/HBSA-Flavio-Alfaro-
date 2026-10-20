import type { UsuarioAutenticado } from '@/features/auth/auth.types';

interface Props {
  usuario: UsuarioAutenticado;
  tema: string;
  cambiarTema: () => void;
  anunciar: (mensaje: string) => void;
}

export function DashboardHeader({ usuario, tema, cambiarTema, anunciar }: Props) {
  const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();

  return (
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">PORTAL INSTITUCIONAL</p>
        <h1>Inicio</h1>
        <p className="header-date">
          {new Intl.DateTimeFormat('es-EC', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          }).format(new Date())}
        </p>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => anunciar('Las notificaciones estarán disponibles próximamente.')}
          aria-label="Notificaciones"
          title="Notificaciones"
        >♧</button>
        <button
          type="button"
          className="icon-button"
          onClick={cambiarTema}
          aria-label={`Cambiar tema. Tema actual: ${tema}`}
          title="Cambiar tema"
        >
          {tema === 'oscuro' ? '☀' : tema === 'alto-contraste' ? '◐' : '☾'}
        </button>
        <div className="profile-pill">
          <div className="avatar" aria-hidden="true">
            {usuario.nombres.charAt(0)}{usuario.apellidos.charAt(0)}
          </div>
          <div className="profile-text">
            <strong>{nombreCompleto}</strong>
            <span>{usuario.cargo.detalle || 'Personal institucional'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
