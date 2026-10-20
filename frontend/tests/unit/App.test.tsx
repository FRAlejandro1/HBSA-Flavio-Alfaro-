import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { App } from '@/App';

const mocks = vi.hoisted(() => ({
  restaurarSesion: vi.fn(),
  iniciarSesion: vi.fn(),
  cerrarSesion: vi.fn(),
  peticionApi: vi.fn(),
}));

vi.mock('@/features/auth/auth.api', () => ({
  restaurarSesion: mocks.restaurarSesion,
  iniciarSesion: mocks.iniciarSesion,
  cerrarSesion: mocks.cerrarSesion,
}));

vi.mock('@/api/http', () => ({
  peticionApi: mocks.peticionApi,
}));

const usuarioSuperadmin: UsuarioAutenticado = {
  id: 1,
  nombres: 'Usuario',
  apellidos: 'Administrador',
  correo: 'admin@example.com',
  rol: 'SUPERADMIN',
  empresa: { id: 1, nombre: 'Hospital de prueba' },
  area: { id: 1, detalle: 'Administración' },
  cargo: { id: 1, detalle: 'Superadministrador' },
};

describe('Aplicación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete document.documentElement.dataset.tema;
    document.documentElement.style.removeProperty('--escala-texto');
    mocks.restaurarSesion.mockResolvedValue(null);
    mocks.cerrarSesion.mockResolvedValue(undefined);
    mocks.peticionApi.mockResolvedValue({
      solicitudes: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });
  });

  it('muestra el formulario de inicio de sesión cuando no existe una sesión activa', async () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sistema de Permisos y Vacaciones',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /ingresar/i }),
    ).toBeInTheDocument();
  });

  it('expone una región principal durante la comprobación de sesión', () => {
    mocks.restaurarSesion.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('muestra los campos de correo y contraseña después de comprobar la sesión', async () => {
    render(<App />);

    expect(
      await screen.findByRole('textbox', { name: 'Correo electrónico' }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('permite mostrar y ocultar la contraseña', async () => {
    render(<App />);

    const campo = await screen.findByLabelText('Contraseña');

    expect(campo).toHaveAttribute('type', 'password');

    screen.getByRole('button', { name: 'Mostrar contraseña' }).click();

    await waitFor(() => {
      expect(campo).toHaveAttribute('type', 'text');
    });

    screen.getByRole('button', { name: 'Ocultar contraseña' }).click();

    await waitFor(() => {
      expect(campo).toHaveAttribute('type', 'password');
    });
  });

  it('muestra la pantalla administrativa a SUPERADMIN y no consulta las vacaciones', async () => {
    mocks.restaurarSesion.mockResolvedValue(usuarioSuperadmin);

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: 'Panel de administración',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Inicio' }),
    ).not.toBeInTheDocument();

    expect(mocks.peticionApi).not.toHaveBeenCalled();
  });

  it('permite cerrar sesión desde la pantalla de SUPERADMIN', async () => {
    mocks.restaurarSesion.mockResolvedValue(usuarioSuperadmin);

    render(<App />);

    await screen.findByRole('heading', {
      name: 'Panel de administración',
    });

    screen.getByRole('button', { name: 'Cerrar sesión' }).click();

    await waitFor(() => {
      expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Sistema de Permisos y Vacaciones',
      }),
    ).toBeInTheDocument();
  });
  it('cambia los temas en orden y persiste cada selección', async () => {
    render(<App />);

    const botonInicial = await screen.findByRole('button', {
      name: 'Cambiar tema. Tema actual: claro',
    });

    expect(document.documentElement.dataset.tema).toBe('claro');

    botonInicial.click();

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('oscuro');
    });

    expect(localStorage.getItem('hbsa-tema')).toBe('oscuro');

    screen.getByRole('button', {
      name: 'Cambiar tema. Tema actual: oscuro',
    }).click();

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('alto-contraste');
    });

    expect(localStorage.getItem('hbsa-tema')).toBe('alto-contraste');

    screen.getByRole('button', {
      name: 'Cambiar tema. Tema actual: alto-contraste',
    }).click();

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('claro');
    });

    expect(localStorage.getItem('hbsa-tema')).toBe('claro');
  });

  it('restaura un tema oscuro válido desde el almacenamiento', async () => {
    localStorage.setItem('hbsa-tema', 'oscuro');

    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem('hbsa-tema')).toBe('oscuro');
  });

  it('restaura una escala de texto válida desde el almacenamiento', async () => {
    localStorage.setItem('hbsa-escala-texto', '1.15');

    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    expect(
      document.documentElement.style.getPropertyValue('--escala-texto'),
    ).toBe('1.15');
  });
  it('restaura el tema claro cuando el valor almacenado no es válido', async () => {
    localStorage.setItem('hbsa-tema', 'tema-inexistente');

    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(localStorage.getItem('hbsa-tema')).toBe('claro');
  });

  it('utiliza los valores predeterminados si falla la lectura del almacenamiento', async () => {
    const obtenerElemento = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('Almacenamiento no disponible');
      });

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sistema de Permisos y Vacaciones',
      }),
    ).toBeInTheDocument();

    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1');

    obtenerElemento.mockRestore();
  });

  it('restaura la escala normal cuando la escala almacenada no es válida', async () => {
    localStorage.setItem('hbsa-escala-texto', '1.7');

    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1');
  });

  it('aplica las tres escalas de texto y anuncia el cambio', async () => {
    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'Reducir tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('0.9');
    expect(screen.getByText('Tamaño de texto reducido.')).toBeInTheDocument();
    expect(localStorage.getItem('hbsa-escala-texto')).toBe('0.9');

    fireEvent.click(screen.getByRole('button', {
      name: 'Aumentar tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1.15');
    expect(screen.getByText('Tamaño de texto aumentado.')).toBeInTheDocument();
    expect(localStorage.getItem('hbsa-escala-texto')).toBe('1.15');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Restablecer tamaño del texto',
      }),
    );

    expect(
      document.documentElement.style.getPropertyValue('--escala-texto'),
    ).toBe('1');

    expect(
      await screen.findByText('Tamaño de texto normal.'),
    ).toBeInTheDocument();

    expect(localStorage.getItem('hbsa-escala-texto')).toBe('1');
  });

  it('permite cerrar la notificación accesible', async () => {
    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'Reducir tamaño del texto',
    }));

    expect(screen.getByText('Tamaño de texto reducido.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mensaje' }));

    expect(screen.queryByText('Tamaño de texto reducido.')).not.toBeInTheDocument();
  });

  it('mantiene la aplicación operativa si falla la escritura en el almacenamiento', async () => {
    const guardarElemento = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Almacenamiento no disponible');
      });

    render(<App />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Sistema de Permisos y Vacaciones',
    });

    screen.getByRole('button', {
      name: 'Cambiar tema. Tema actual: claro',
    }).click();

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('oscuro');
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'Aumentar tamaño del texto',
    }));

    expect(document.documentElement.style.getPropertyValue('--escala-texto')).toBe('1.15');
    expect(screen.getByText('Tamaño de texto aumentado.')).toBeInTheDocument();

    guardarElemento.mockRestore();
  });

  it('muestra el panel normal para un usuario autenticado que no es SUPERADMIN', async () => {
    mocks.restaurarSesion.mockResolvedValue({
      ...usuarioSuperadmin,
      rol: 'JEFE_AREA',
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Inicio' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Panel de administración' }),
    ).not.toBeInTheDocument();
  });
});
