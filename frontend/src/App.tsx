import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Variables } from '@/config/Variables';
import { LoginPage } from '@/features/auth/LoginPage';
import {
  restaurarSesion,
} from '@/features/auth/auth.api';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SuperadminPage } from '@/features/dashboard/SuperadminPage';
import '@/styles/app.css';

type Tema = 'claro' | 'oscuro' | 'alto-contraste';

const CLAVE_TEMA = 'hbsa-tema';
const CLAVE_ESCALA_TEXTO = 'hbsa-escala-texto';

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Variables.cacheTiempoMs,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function leerTemaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);

    if (
      guardado === 'claro' ||
      guardado === 'oscuro' ||
      guardado === 'alto-contraste'
    ) {
      return guardado;
    }
  } catch {
    // La aplicación sigue funcionando si el almacenamiento no está disponible.
  }

  return 'claro';
}

function leerEscalaInicial(): string {
  try {
    const escala = localStorage.getItem(CLAVE_ESCALA_TEXTO);

    if (escala === '0.9' || escala === '1' || escala === '1.15') {
      return escala;
    }
  } catch {
    // Se utiliza la escala normal como alternativa.
  }

  return '1';
}

function Aplicacion() {
  const [tema, setTema] = useState<Tema>(leerTemaInicial);
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [comprobandoSesion, setComprobandoSesion] = useState(true);
  const [mensaje, setMensaje] = useState('');

  const anunciar = useCallback((nuevoMensaje: string) => {
    setMensaje(nuevoMensaje);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;

    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // El tema permanece activo durante la sesión actual.
    }
  }, [tema]);

  useEffect(() => {
    const escala = leerEscalaInicial();
    document.documentElement.style.setProperty('--escala-texto', escala);
  }, []);

  useEffect(() => {
    let activo = true;

    async function comprobarSesion() {
      try {
        const sesion = await restaurarSesion();

        if (activo) {
          setUsuario(sesion);
        }
      } finally {
        if (activo) {
          setComprobandoSesion(false);
        }
      }
    }

    void comprobarSesion();

    return () => {
      activo = false;
    };
  }, []);

  const cambiarTema = useCallback(() => {
    setTema((actual) => {
      if (actual === 'claro') return 'oscuro';
      if (actual === 'oscuro') return 'alto-contraste';
      return 'claro';
    });
  }, []);

  function cambiarEscala(escala: '0.9' | '1' | '1.15') {
    document.documentElement.style.setProperty('--escala-texto', escala);

    try {
      localStorage.setItem(CLAVE_ESCALA_TEXTO, escala);
    } catch {
      // La escala se conserva hasta que se cierre o recargue la página.
    }

    anunciar(
      escala === '0.9'
        ? 'Tamaño de texto reducido.'
        : escala === '1.15'
          ? 'Tamaño de texto aumentado.'
          : 'Tamaño de texto normal.',
    );
  }

  function cerrarSesionLocal() {
    setUsuario(null);
    setMensaje('La sesión se ha cerrado.');
  }

  if (comprobandoSesion) {
    return (
      <main className="session-loading" aria-live="polite">
        <div className="brand-mark" aria-hidden="true">HB</div>
        <span className="spinner" aria-hidden="true" />
        <p>Comprobando la sesión institucional…</p>
      </main>
    );
  }

  return (
    <>
      {usuario ? (
        usuario.rol === 'SUPERADMIN' ? (
          <SuperadminPage
            usuario={usuario}
            onLogout={cerrarSesionLocal}
            tema={tema}
            cambiarTema={cambiarTema}
            anunciar={anunciar}
          />
        ) : (
          <DashboardPage
            usuario={usuario}
            onLogout={cerrarSesionLocal}
            tema={tema}
            cambiarTema={cambiarTema}
            anunciar={anunciar}
          />
        )
      ) : (
        <LoginPage
          onLogin={setUsuario}
          tema={tema}
          cambiarTema={cambiarTema}
        />
      )}

      {mensaje && (
        <div className="toast-region" aria-live="polite" aria-atomic="true">
          <div className="toast-message">
            <span>{mensaje}</span>
            <button
              type="button"
              aria-label="Cerrar mensaje"
              onClick={() => setMensaje('')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="accessibility-tools" aria-label="Accesibilidad">
          <button
            type="button"
            onClick={() => cambiarEscala('0.9')}
            aria-label="Reducir tamaño del texto"
            title="Reducir texto"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => cambiarEscala('1')}
            aria-label="Restablecer tamaño del texto"
            title="Texto normal"
          >
            A
          </button>
          <button
            type="button"
            onClick={() => cambiarEscala('1.15')}
            aria-label="Aumentar tamaño del texto"
            title="Aumentar texto"
          >
            A+
          </button>
        </div>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <Aplicacion />
    </QueryClientProvider>
  );
}
