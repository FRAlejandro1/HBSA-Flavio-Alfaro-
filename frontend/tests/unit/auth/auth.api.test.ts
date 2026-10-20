import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';

const mocks = vi.hoisted(() => ({
  establecerTokenAcceso: vi.fn(),
  obtenerTokenCsrf: vi.fn(),
  peticionApi: vi.fn(),
}));

vi.mock('@/api/http', () => ({
  establecerTokenAcceso: mocks.establecerTokenAcceso,
  obtenerTokenCsrf: mocks.obtenerTokenCsrf,
  peticionApi: mocks.peticionApi,
}));

import { cerrarSesion, iniciarSesion, restaurarSesion } from '@/features/auth/auth.api';

const usuario: UsuarioAutenticado = {
  id: 7,
  nombres: 'Ana',
  apellidos: 'Prueba',
  correo: 'ana@example.com',
  rol: 'EMPLEADO',
  empresa: { id: 1, nombre: 'Hospital' },
  area: { id: 2, detalle: 'Consulta' },
  cargo: { id: 3, detalle: 'Médica' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obtenerTokenCsrf.mockResolvedValue('csrf');
});

describe('API de autenticación', () => {
  it('inicia sesión y establece el token', async () => {
    mocks.peticionApi.mockResolvedValue({ accessToken: 'access', expiraEn: 300, usuario });

    await expect(iniciarSesion('ana@example.com', 'secreto')).resolves.toEqual(usuario);

    expect(mocks.obtenerTokenCsrf).toHaveBeenCalledOnce();
    expect(mocks.peticionApi).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { correo: 'ana@example.com', clave: 'secreto' },
    });
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith('access');
  });

  it('propaga los errores del inicio de sesión', async () => {
    mocks.peticionApi.mockRejectedValue(new Error('falló login'));
    await expect(iniciarSesion('ana@example.com', 'incorrecta')).rejects.toThrow('falló login');
    expect(mocks.establecerTokenAcceso).not.toHaveBeenCalled();
  });

  it('restaura la sesión renovando el token y consultando al usuario', async () => {
    mocks.peticionApi
      .mockResolvedValueOnce({ accessToken: 'renovado', expiraEn: 300 })
      .mockResolvedValueOnce({ usuario });

    await expect(restaurarSesion()).resolves.toEqual(usuario);
    expect(mocks.peticionApi).toHaveBeenNthCalledWith(1, '/api/auth/refresh', {
      method: 'POST',
      body: {},
    });
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith('renovado');
    expect(mocks.peticionApi).toHaveBeenNthCalledWith(2, '/api/auth/me', {
      autenticada: true,
    });
  });

  it('limpia el token y devuelve null si falla la restauración', async () => {
    mocks.peticionApi.mockRejectedValue(new Error('sesión expirada'));
    await expect(restaurarSesion()).resolves.toBeNull();
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith(null);
  });

  it('limpia el token si falla la obtención inicial de CSRF', async () => {
    mocks.obtenerTokenCsrf.mockRejectedValue(new Error('CSRF no disponible'));
    await expect(restaurarSesion()).resolves.toBeNull();
    expect(mocks.peticionApi).not.toHaveBeenCalled();
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith(null);
  });

  it('cierra sesión y limpia el token', async () => {
    mocks.peticionApi.mockResolvedValue(undefined);
    await expect(cerrarSesion()).resolves.toBeUndefined();

    expect(mocks.peticionApi).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      autenticada: true,
      body: {},
    });
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith(null);
  });

  it('limpia el token aunque falle el cierre de sesión', async () => {
    mocks.peticionApi.mockRejectedValue(new Error('falló logout'));
    await expect(cerrarSesion()).rejects.toThrow('falló logout');
    expect(mocks.establecerTokenAcceso).toHaveBeenCalledWith(null);
  });
});
