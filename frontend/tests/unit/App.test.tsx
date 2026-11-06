import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { App } from '../../src/App';

const mocks = vi.hoisted(() => ({
  restaurarSesion: vi.fn(),
  cerrarSesion: vi.fn(),
}));

vi.mock('@/features/auth/auth.api', () => ({
  cerrarSesion: mocks.cerrarSesion,
  restaurarSesion: mocks.restaurarSesion,
}));

vi.mock('@/features/auth/LoginPage', () => ({
  LoginPage: ({
    onLogin,
    tema,
    cambiarTema,
  }: {
    onLogin: (usuario: UsuarioAutenticado) => void;
    tema: string;
    cambiarTema: () => void;
  }) => (
    <main data-testid="login-page">
      <h1>Acceso institucional</h1>
      <span>Tema: {tema}</span>
      <button type="button" onClick={cambiarTema}>
        Cambiar tema
      </button>
      <button
        type="button"
        onClick={() => onLogin({
          id: 1,
          nombres: 'Ana',
          apellidos: 'Pérez',
          correo: 'ana@hospital.gob.ec',
          rol: 'EMPLEADO',
          empresa: { id: 1, nombre: 'Hospital de prueba' },
          area: { id: 1, detalle: 'Administración' },
          cargo: { id: 1, detalle: 'Analista' },
        })}
      >
        Simular inicio de sesión
      </button>
    </main>
  ),
}));

vi.mock('@/features/dashboard/DashboardPage', () => ({
  DashboardPage: ({
    usuario,
    onLogout,
    tema,
    cambiarTema,
    anunciar,
  }: {
    usuario: UsuarioAutenticado;
    onLogout: () => void;
    tema: string;
    cambiarTema: () => void;
    anunciar: (mensaje: string) => void;
  }) => (
    <main data-testid="dashboard-page">
      <h1>Panel de empleado</h1>
      <span>{usuario.nombres} {usuario.apellidos}</span>
      <span>{usuario.rol}</span>
      <span>Tema: {tema}</span>
      <button type="button" onClick={cambiarTema}>Cambiar tema del panel</button>
      <button type="button" onClick={() => anunciar('Aviso de prueba')}>
        Mostrar aviso
      </button>
      <button type="button" onClick={onLogout}>Cerrar sesión simulada</button>
    </main>
  ),
}));

vi.mock('@/features/superadmin/SuperadminPage', () => ({
  SuperadminPage: ({
    usuario,
    onLogout,
  }: {
    usuario: UsuarioAutenticado;
    onLogout: () => void;
  }) => (
    <main data-testid="superadmin-page">
      <h1>Panel de superadministración</h1>
      <span>{usuario.nombres} {usuario.apellidos}</span>
      <span>{usuario.rol}</span>
      <button type="button" onClick={onLogout}>Cerrar sesión simulada</button>
    </main>
  ),
}));

function crearUsuario(
  rol: UsuarioAutenticado['rol'] = 'EMPLEADO',
): UsuarioAutenticado {
  return {
    id: 1,
    nombres: 'Ana',
    apellidos: 'Pérez',
    correo: 'ana@hospital.gob.ec',
    rol,
    empresa: { id: 1, nombre: 'Hospital de prueba' },
    area: { id: 1, detalle: 'Administración' },
    cargo: { id: 1, detalle: 'Analista' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.restaurarSesion.mockResolvedValue(null);
  mocks.cerrarSesion.mockResolvedValue(undefined);
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
  document.documentElement.style.removeProperty('--escala-texto');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Aplicación principal', () => {
  it('muestra la pantalla de comprobación mientras restaura la sesión', () => {
    mocks.restaurarSesion.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByText('Comprobando la sesión institucional…')).toBeTruthy();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  it('muestra el acceso cuando no existe una sesión restaurada', async () => {
    render(<App />);

    expect(await screen.findByTestId('login-page')).toBeTruthy();
    expect(mocks.restaurarSesion).toHaveBeenCalledOnce();
  });

  it('muestra el dashboard cuando restaura una sesión de empleado', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());

    render(<App />);

    expect(await screen.findByTestId('dashboard-page')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('EMPLEADO')).toBeTruthy();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  it('muestra el panel de superadministración para el rol SUPERADMIN', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario('SUPERADMIN'));

    render(<App />);

    expect(await screen.findByTestId('superadmin-page')).toBeTruthy();
    expect(screen.getByText('SUPERADMIN')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-page')).toBeNull();
  });

  it('permite cerrar la sesión del superadministrador', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario('SUPERADMIN'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Cerrar sesión simulada',
    }));

    expect(await screen.findByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('superadmin-page')).toBeNull();
    expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    expect(await screen.findByText('La sesión se ha cerrado.')).toBeTruthy();
  });
  it('permite iniciar sesión y mostrar el dashboard', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Simular inicio de sesión',
    }));

    expect(await screen.findByTestId('dashboard-page')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
  });

  it('regresa al acceso cuando el servidor confirma el cierre de sesión', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());

    render(<App />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Cerrar sesión simulada',
    }));

    expect(await screen.findByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-page')).toBeNull();
    expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    expect(await screen.findByText('La sesión se ha cerrado.')).toBeTruthy();
  });

  it('regresa al acceso e informa cuando el servidor no confirma el cierre', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());
    mocks.cerrarSesion.mockRejectedValueOnce(new Error('Error de conexión'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Cerrar sesión simulada',
    }));

    expect(await screen.findByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-page')).toBeNull();
    expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    expect(await screen.findByText(
      'No se pudo confirmar el cierre de sesión en el servidor.',
    )).toBeTruthy();
  });
  it('restaura las preferencias válidas guardadas', async () => {
    localStorage.setItem('hbsa-tema', 'alto-contraste');
    localStorage.setItem('hbsa-escala-texto', '1.15');

    render(<App />);

    await screen.findByTestId('login-page');

    expect(document.documentElement.dataset.tema).toBe('alto-contraste');
    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1.15');
  });

  it('utiliza los valores predeterminados cuando falla la lectura del almacenamiento', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Almacenamiento no disponible');
    });

    render(<App />);

    await screen.findByTestId('login-page');

    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1');
  });

  it('mantiene las preferencias activas cuando falla su persistencia', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Almacenamiento no disponible');
    });

    render(<App />);

    await screen.findByTestId('dashboard-page');

    fireEvent.click(screen.getByRole('button', {
      name: 'Cambiar tema del panel',
    }));

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('oscuro');
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'Reducir tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('0.9');
    expect(screen.getByText('Tamaño de texto reducido.')).toBeTruthy();
  });
  it('alterna los temas y persiste la preferencia seleccionada', async () => {
    render(<App />);

    const botonTema = await screen.findByRole('button', {
      name: 'Cambiar tema',
    });

    expect(document.documentElement.dataset.tema).toBe('claro');

    fireEvent.click(botonTema);
    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('oscuro');
    });
    expect(localStorage.getItem('hbsa-tema')).toBe('oscuro');

    fireEvent.click(botonTema);
    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('alto-contraste');
    });

    fireEvent.click(botonTema);
    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('claro');
    });
  });

  it('aplica la escala de texto y permite cerrar las notificaciones', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());

    render(<App />);

    await screen.findByTestId('dashboard-page');

    fireEvent.click(screen.getByRole('button', {
      name: 'Reducir tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('0.9');
    expect(screen.getByText('Tamaño de texto reducido.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {
      name: 'Cerrar mensaje',
    }));

    expect(screen.queryByText('Tamaño de texto reducido.')).toBeNull();

    fireEvent.click(screen.getByRole('button', {
      name: 'Aumentar tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1.15');
    expect(screen.getByText('Tamaño de texto aumentado.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {
      name: 'Restablecer tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1');
    expect(screen.getByText('Tamaño de texto normal.')).toBeTruthy();
  });

  it('muestra y permite cerrar los avisos generados desde el dashboard', async () => {
    mocks.restaurarSesion.mockResolvedValue(crearUsuario());

    render(<App />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Mostrar aviso',
    }));

    expect(screen.getByText('Aviso de prueba')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {
      name: 'Cerrar mensaje',
    }));

    expect(screen.queryByText('Aviso de prueba')).toBeNull();
  });
});