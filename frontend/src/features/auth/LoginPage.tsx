import { useState, type FormEvent } from 'react';
import { ErrorApi } from '@/api/http';
import { iniciarSesion } from '@/features/auth/auth.api';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';

interface Props {
  onLogin: (usuario: UsuarioAutenticado) => void;
  tema: string;
  cambiarTema: () => void;

}

export function LoginPage({ onLogin, tema, cambiarTema }: Props) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    setCargando(true);

    try {
      const usuario = await iniciarSesion(correo.trim(), clave);
      onLogin(usuario);
    } catch (errorDesconocido) {
      const errorApi = errorDesconocido instanceof ErrorApi
        ? errorDesconocido
        : null;

      const mensaje = errorApi?.estado === 429
        ? 'Demasiados intentos. Espere un momento antes de intentarlo de nuevo.'
        : errorApi?.estado === 401
          ? 'Correo o clave incorrectos.'
          : errorDesconocido instanceof Error
            ? errorDesconocido.message
            : 'No fue posible iniciar sesión. Inténtelo nuevamente.';

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-toolbar">
        <button
          className="icon-button"
          type="button"
          onClick={cambiarTema}
          aria-label={`Cambiar tema. Tema actual: ${tema}`}
          title="Cambiar tema"
        >
          {tema === 'oscuro' ? '☀' : tema === 'alto-contraste' ? '◐' : '☾'}
        </button>
      </div>

      <section className="login-card" aria-labelledby="titulo-login">
        <div className="brand-mark" aria-hidden="true">HB</div>
        <h1 className="login-brand-title">Sistema de Permisos y Vacaciones</h1>
        <p className="login-subtitle">Hospital Básico San Andrés · Flavio Alfaro</p>

        <div className="login-divider" />

        <h2 id="titulo-login" className="login-heading">Iniciar sesión</h2>
        <p className="login-description">
          Ingrese sus credenciales institucionales para continuar.
        </p>

        <form
          className="login-form"
          onSubmit={(evento) => {
            void enviar(evento);
          }}
        >
          <label htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            placeholder="nombre@institucion.gob.ec"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            maxLength={150}
            required
            disabled={cargando}
          />

          <label htmlFor="clave">Contraseña</label>
          <div className="password-field">
            <input
              id="clave"
              name="clave"
              type={mostrarClave ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ingrese su contraseña"
              value={clave}
              onChange={(evento) => setClave(evento.target.value)}
              required
              disabled={cargando}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setMostrarClave((actual) => !actual)}
              aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {error && (
            <div className="feedback feedback-error" role="alert">
              <span aria-hidden="true">!</span>
              <span>{error}</span>
            </div>
          )}

          <button className="primary-button login-submit" type="submit" disabled={cargando}>
            {cargando ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Verificando credenciales…
              </>
            ) : (
              <>Ingresar <span aria-hidden="true">→</span></>
            )}
          </button>
        </form>

        <div className="login-help">
          <span className="help-icon" aria-hidden="true">i</span>
          <p>
            ¿Olvidó su contraseña o no tiene cuenta? Comuníquese con
            Talento Humano para recibir asistencia.
          </p>
        </div>
      </section>

      <footer className="login-footer">
        Sistema institucional de gestión de permisos y vacaciones
      </footer>

    </main>
  );
}
