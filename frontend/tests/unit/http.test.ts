import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function respuesta(status: number, cuerpo?: unknown, ok = status >= 200 && status < 300): Response {
  return {
    status,
    ok,
    json: vi.fn().mockResolvedValue(cuerpo),
  } as unknown as Response;
}

const fetchMock = vi.fn();
import type * as HttpModule from '@/api/http';

let http: typeof HttpModule;

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  http = await import('@/api/http');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente HTTP', () => {
  it('almacena y devuelve el token de acceso', () => {
    http.establecerTokenAcceso('token-prueba');
    expect(http.obtenerTokenAcceso()).toBe('token-prueba');
    http.establecerTokenAcceso(null);
    expect(http.obtenerTokenAcceso()).toBeNull();
  });

  it('obtiene el token CSRF', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }));
    await expect(http.obtenerTokenCsrf()).resolves.toBe('csrf-prueba');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('interpreta el mensaje de error de la API', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(503, { mensaje: 'Servicio no disponible' }, false));
    await expect(http.obtenerTokenCsrf()).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 503,
      message: 'Servicio no disponible',
    });
  });

  it('rechaza una respuesta CSRF sin token válido', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { csrfToken: 42 }));
    await expect(http.obtenerTokenCsrf()).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 200,
      message: 'La API no devolvió un token CSRF válido.',
    });
  });

  it.each([
    [{ message: 'mensaje alternativo' }, 'mensaje alternativo'],
    [{ error: 'error textual' }, 'error textual'],
    [{ error: { message: 'detalle message' } }, 'detalle message'],
    [{ error: { mensaje: 'detalle mensaje' } }, 'detalle mensaje'],
    [null, 'No se pudo completar la solicitud.'],
  ])('interpreta errores HTTP con distintas estructuras', async (cuerpo, mensaje) => {
    fetchMock.mockResolvedValueOnce(respuesta(400, cuerpo, false));
    await expect(http.peticionApi('/api/prueba')).rejects.toMatchObject({
      estado: 400,
      message: mensaje,
    });
  });

  it('usa el mensaje específico para HTTP 429 cuando no hay JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ...respuesta(429, undefined, false),
      json: vi.fn().mockRejectedValue(new Error('sin JSON')),
    });
    await expect(http.peticionApi('/api/prueba')).rejects.toMatchObject({
      estado: 429,
      message: 'Demasiados intentos. Espere antes de volver a intentarlo.',
    });
  });

  it('envía GET con credenciales y cabeceras personalizadas', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { correcto: true }));
    await expect(http.peticionApi('/api/prueba', {
      headers: { 'X-Prueba': 'valor' },
    })).resolves.toEqual({ correcto: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/prueba', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Prueba': 'valor' },
    });
  });

  it('envía token de acceso, CSRF y JSON al modificar estado', async () => {
    http.establecerTokenAcceso('access-prueba');
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(200, { guardado: true }));

    await expect(http.peticionApi('/api/prueba', {
      method: 'POST',
      autenticada: true,
      body: { valor: 1 },
    })).resolves.toEqual({ guardado: true });

    expect(fetchMock).toHaveBeenLastCalledWith('/api/prueba', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-prueba',
        'X-CSRF-Token': 'csrf-prueba',
      },
      body: JSON.stringify({ valor: 1 }),
    });
  });

  it.each(['HEAD', 'OPTIONS'])('no solicita CSRF para %s', async (method) => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { correcto: true }));
    await http.peticionApi('/api/prueba', { method });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('devuelve undefined para HTTP 204', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(204));
    await expect(http.peticionApi('/api/prueba', {
      method: 'DELETE',
    })).resolves.toBeUndefined();
  });

  it('renueva el access token y repite una petición autenticada tras HTTP 401', async () => {
    http.establecerTokenAcceso('access-vencido');

    fetchMock
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Token expirado' }, false))
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(200, {
        accessToken: 'access-renovado',
        expiraEn: 1800000000,
      }))
      .mockResolvedValueOnce(respuesta(200, { usuario: 'correcto' }));

    await expect(http.peticionApi('/api/prueba', {
      autenticada: true,
    })).resolves.toEqual({ usuario: 'correcto' });

    expect(http.obtenerTokenAcceso()).toBe('access-renovado');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-prueba',
      },
      body: JSON.stringify({}),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/prueba', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-renovado',
      },
    });
  });

  it('limpia el access token cuando falla el refresh', async () => {
    http.establecerTokenAcceso('access-vencido');

    fetchMock
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Token expirado' }, false))
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Refresh inválido' }, false));

    await expect(http.peticionApi('/api/prueba', {
      autenticada: true,
    })).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 401,
    });

    expect(http.obtenerTokenAcceso()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('no intenta refresh para una petición no autenticada que recibe HTTP 401', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(401, { mensaje: 'No autenticado' }, false),
    );

    await expect(http.peticionApi('/api/prueba')).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 401,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(http.obtenerTokenAcceso()).toBeNull();
  });

  it('limpia la sesión si el refresh devuelve un access token vacío', async () => {
    http.establecerTokenAcceso('access-vencido');

    fetchMock
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Token expirado' }, false))
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(200, {
        accessToken: '',
        expiraEn: 1800000000,
      }));

    await expect(http.peticionApi('/api/prueba', {
      autenticada: true,
    })).rejects.toMatchObject({
      name: 'ErrorApi',
      estado: 401,
      message: 'Token expirado',
    });

    expect(http.obtenerTokenAcceso()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('no repite indefinidamente el refresh cuando falla su propio endpoint', async () => {
    http.establecerTokenAcceso('access-vencido');

    fetchMock
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Token expirado' }, false))
      .mockResolvedValueOnce(respuesta(200, { csrfToken: 'csrf-prueba' }))
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Refresh inválido' }, false));

    await expect(http.peticionApi('/api/prueba', {
      autenticada: true,
    })).rejects.toMatchObject({
      estado: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});