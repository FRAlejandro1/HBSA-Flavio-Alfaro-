import { useState } from 'react';
import { cerrarSesion } from '@/features/auth/auth.api';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';

interface Props {
  usuario: UsuarioAutenticado;
  onLogout: () => void;
  tema: string;
  cambiarTema: () => void;
  anunciar: (mensaje: string) => void;
}

export function SuperadminPage({
  usuario,
  onLogout,
  tema,
  cambiarTema,
  anunciar,
}: Props) {
  const [cerrando, setCerrando] = useState(false);

  async function salir() {
    setCerrando(true);

    try {
      await cerrarSesion();
    } catch {
      anunciar('No se pudo confirmar el cierre de sesión con el servidor.');
    } finally {
      onLogout();
      setCerrando(false);
    }
  }

  const nombreCompleto =
    `${usuario.nombres} ${usuario.apellidos}`.trim();

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="superadmin-title">
        <div className="brand-mark" aria-hidden="true">
          HB
        </div>

        <p className="eyebrow">PORTAL INSTITUCIONAL</p>

        <h1 id="superadmin-title" className="login-heading">
          Panel de administración
        </h1>

        <p className="login-description">
          Has iniciado sesión con una cuenta de superadministración.
          El panel administrativo definitivo estará disponible próximamente.
        </p>

        <div className="login-divider" />

        <p>
          <strong>Usuario:</strong> {nombreCompleto}
        </p>

        <p>
          <strong>Rol:</strong> SUPERADMIN
        </p>

        <p>
          <strong>Institución:</strong> {usuario.empresa.nombre}
        </p>

        <div className="login-form">
          <button
            type="button"
            className="secondary-button"
            onClick={cambiarTema}
            aria-label={`Cambiar tema. Tema actual: ${tema}`}
          >
            Cambiar tema
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => void salir()}
            disabled={cerrando}
          >
            {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </section>
    </main>
  );
}
