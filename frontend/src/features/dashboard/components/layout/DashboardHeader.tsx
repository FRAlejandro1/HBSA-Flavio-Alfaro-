import { Fragment } from 'react';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import '@/features/dashboard/components/layout/layout.css';

export interface MigaDePan {
  texto: string;
  alSeleccionar?: (() => void) | undefined;
}

interface Props {
  usuario: UsuarioAutenticado;
  tema: string;
  cambiarTema: () => void;
  anunciar: (mensaje: string) => void;
  // Vista secundaria: cambia la fecha y el saludo por la ruta de regreso y el título de la vista
  titulo?: string | undefined;
  migas?: MigaDePan[] | undefined;
}

export function DashboardHeader({
  usuario,
  tema,
  cambiarTema,
  anunciar,
  titulo,
  migas,
}: Props) {
  const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();
  const cargo = usuario.cargo.detalle || 'Personal institucional';
  const area = usuario.area.detalle || 'Área no especificada';

  return (
    <header className="dashboard-header">
      <div>
        {titulo ? (
          <nav className="header-breadcrumb" aria-label="Ruta de navegación">
            {(migas ?? []).map((miga) => (
              <Fragment key={miga.texto}>
                {miga.alSeleccionar ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={miga.alSeleccionar}
                  >
                    {miga.texto}
                  </button>
                ) : (
                  <span>{miga.texto}</span>
                )}
                <span aria-hidden="true">/</span>
              </Fragment>
            ))}
            <span aria-current="page">{titulo}</span>
          </nav>
        ) : (
          <p className="header-date">
            {new Intl.DateTimeFormat('es-EC', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            }).format(new Date())}
          </p>
        )}
        <h1 id="titulo-pagina" tabIndex={-1}>
          {titulo ?? `Hola, ${usuario.nombres}`}
        </h1>
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
            <span>{cargo} · {area}</span>
          </div>
        </div>
      </div>
    </header>
  );
}