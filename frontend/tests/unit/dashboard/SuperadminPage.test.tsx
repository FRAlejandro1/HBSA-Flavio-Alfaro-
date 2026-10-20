import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { SuperadminPage } from '@/features/dashboard/SuperadminPage';

const mocks = vi.hoisted(() => ({
  cerrarSesion: vi.fn(),
}));

vi.mock('@/features/auth/auth.api', () => ({
  cerrarSesion: mocks.cerrarSesion,
}));

const usuario: UsuarioAutenticado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@example.com',
  rol: 'SUPERADMIN',
  empresa: { id: 1, nombre: 'Hospital de prueba' },
  area: { id: 1, detalle: 'Administración' },
  cargo: { id: 1, detalle: 'Superadministradora' },
};

function renderSuperadmin() {
  const onLogout = vi.fn();
  const anunciar = vi.fn();
  const cambiarTema = vi.fn();

  render(
    <SuperadminPage
      usuario={usuario}
      onLogout={onLogout}
      tema="claro"
      cambiarTema={cambiarTema}
      anunciar={anunciar}
    />,
  );

  return { onLogout, anunciar, cambiarTema };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cerrarSesion.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('SuperadminPage', () => {
  it('muestra los datos del superadministrador', () => {
    renderSuperadmin();

    expect(
      screen.getByRole('heading', { name: 'Panel de administración' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
    expect(screen.getByText('Hospital de prueba')).toBeInTheDocument();
  });

  it('permite cambiar el tema', () => {
    const { cambiarTema } = renderSuperadmin();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar tema. Tema actual: claro' }),
    );

    expect(cambiarTema).toHaveBeenCalledOnce();
  });

  it('cierra la sesión y notifica al componente superior', async () => {
    const { onLogout } = renderSuperadmin();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => {
      expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
      expect(onLogout).toHaveBeenCalledOnce();
    });
  });

  it('notifica el error del servidor y finaliza el cierre de sesión', async () => {
    mocks.cerrarSesion.mockRejectedValueOnce(
      new Error('sesión no disponible'),
    );

    const { onLogout, anunciar } = renderSuperadmin();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledOnce();
      expect(anunciar).toHaveBeenCalledWith(
        'No se pudo confirmar el cierre de sesión con el servidor.',
      );
    });
  });
});
