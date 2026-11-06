// Pruebas unitarias del controlador HTTP de autenticacion.
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  COOKIE_REFRESH,
  crearAuthController,
} from '../../../../src/modules/auth/auth.controller';
import { COOKIE_CSRF } from '../../../../src/middlewares/csrf';
import type { AuthService } from '../../../../src/modules/auth/auth.service';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';

function crearRespuesta() {
  const cookie = vi.fn();
  const json = vi.fn();
  const clearCookie = vi.fn();
  const status = vi.fn();
  const end = vi.fn();

  const res = {
    cookie,
    json,
    clearCookie,
    status,
    end,
  } as unknown as Response;

  status.mockReturnValue(res);

  return { res, cookie, json, clearCookie, status, end };
}

async function ejecutarHandler(
  handler: RequestHandler,
  req: Request,
  res: Response,
): Promise<void> {
  const ejecutar = handler as unknown as (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>;

  await ejecutar(req, res, () => undefined);
}

function crearUsuario(): UsuarioAutenticado {
  return {
    id: 10,
    empresaId: 7,
    rol: 'EMPLEADO',
    jti: 'token-access',
    expira: 1_800_000_000,
  } as unknown as UsuarioAutenticado;
}

describe('AuthController', () => {
  const opciones = {
    secure: false,
    ttlRefreshSegundos: 3600,
  };

  it('genera y entrega el token CSRF mediante cookie y respuesta JSON', async () => {
    const servicio = {} as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();

    await ejecutarHandler(controller.obtenerCsrf, {} as Request, respuesta.res);

    expect(respuesta.cookie.mock.calls).toHaveLength(1);
    expect(respuesta.cookie.mock.calls[0]?.[0]).toBe(COOKIE_CSRF);
    expect(respuesta.cookie.mock.calls[0]?.[2]).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
    });

    const cuerpo = respuesta.json.mock.calls[0]?.[0] as {
      csrfToken: string;
    };

    expect(cuerpo.csrfToken).toEqual(expect.any(String));
    expect(respuesta.cookie.mock.calls[0]?.[1]).toBe(cuerpo.csrfToken);
  });

  it('inicia sesión, establece la cookie refresh y no la incluye en el cuerpo', async () => {
    const resultado = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiraEn: 900,
      usuario: { id: 10, correo: 'empleado@hospital.test' },
    };

    const login = vi.fn().mockResolvedValue(resultado);
    const servicio = { login } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();
    const req = {
      body: { correo: 'empleado@hospital.test', clave: 'ClaveSegura123!' },
    } as unknown as Request;

    await ejecutarHandler(controller.login, req, respuesta.res);

    expect(login.mock.calls).toEqual([
      ['empleado@hospital.test', 'ClaveSegura123!'],
    ]);
    expect(respuesta.cookie.mock.calls[0]).toEqual([
      COOKIE_REFRESH,
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 3_600_000,
      }),
    ]);
    expect(respuesta.json.mock.calls[0]?.[0]).toEqual({
      accessToken: 'access-token',
      expiraEn: 900,
      usuario: resultado.usuario,
    });
  });

  it('propaga los errores del servicio al iniciar sesión', async () => {
    const error = new Error('Error de autenticación');
    const login = vi.fn().mockRejectedValue(error);
    const servicio = { login } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();
    const req = {
      body: { correo: 'empleado@hospital.test', clave: 'incorrecta' },
    } as unknown as Request;

    await expect(
      ejecutarHandler(controller.login, req, respuesta.res),
    ).rejects.toBe(error);

    expect(respuesta.cookie.mock.calls).toHaveLength(0);
    expect(respuesta.json.mock.calls).toHaveLength(0);
  });

  it('rechaza refresh cuando req.cookies no existe', async () => {
    const refrescar = vi.fn();
    const servicio = { refrescar } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);

    await expect(
      ejecutarHandler(
        controller.refresh,
        { cookies: undefined } as unknown as Request,
        crearRespuesta().res,
      ),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });

    expect(refrescar.mock.calls).toHaveLength(0);
  });

  it('rechaza refresh cuando la cookie no contiene el token', async () => {
    const refrescar = vi.fn();
    const servicio = { refrescar } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);

    await expect(
      ejecutarHandler(
        controller.refresh,
        { cookies: {} } as unknown as Request,
        crearRespuesta().res,
      ),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });

    expect(refrescar.mock.calls).toHaveLength(0);
  });

  it('rota el refresh token y responde con el nuevo access token', async () => {
    const refrescar = vi.fn().mockResolvedValue({
      accessToken: 'nuevo-access',
      refreshToken: 'nuevo-refresh',
      expiraEn: 900,
    });
    const servicio = { refrescar } as unknown as AuthService;
    const controller = crearAuthController(servicio, {
      secure: true,
      ttlRefreshSegundos: 1800,
    });
    const respuesta = crearRespuesta();

    await ejecutarHandler(
      controller.refresh,
      { cookies: { [COOKIE_REFRESH]: 'refresh-anterior' } } as unknown as Request,
      respuesta.res,
    );

    expect(refrescar.mock.calls).toEqual([['refresh-anterior']]);
    expect(respuesta.cookie.mock.calls[0]).toEqual([
      COOKIE_REFRESH,
      'nuevo-refresh',
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        path: '/api/auth',
        maxAge: 1_800_000,
      }),
    ]);
    expect(respuesta.json.mock.calls[0]?.[0]).toEqual({
      accessToken: 'nuevo-access',
      expiraEn: 900,
    });
  });

  it('propaga los errores del servicio al refrescar la sesión', async () => {
    const error = new Error('Refresh inválido');
    const refrescar = vi.fn().mockRejectedValue(error);
    const servicio = { refrescar } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();

    await expect(
      ejecutarHandler(
        controller.refresh,
        { cookies: { [COOKIE_REFRESH]: 'refresh-invalido' } } as unknown as Request,
        respuesta.res,
      ),
    ).rejects.toBe(error);

    expect(respuesta.cookie.mock.calls).toHaveLength(0);
  });

  it('rechaza logout cuando no existe un usuario autenticado', async () => {
    const cerrarSesion = vi.fn();
    const servicio = { cerrarSesion } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);

    await expect(
      ejecutarHandler(
        controller.logout,
        { usuario: undefined } as unknown as Request,
        crearRespuesta().res,
      ),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });

    expect(cerrarSesion.mock.calls).toHaveLength(0);
  });

  it('cierra sesión, elimina la cookie refresh y responde con HTTP 204', async () => {
    const usuario = crearUsuario();
    const cerrarSesion = vi.fn().mockResolvedValue(undefined);
    const servicio = { cerrarSesion } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();

    await ejecutarHandler(
      controller.logout,
      { usuario } as unknown as Request,
      respuesta.res,
    );

    expect(cerrarSesion.mock.calls).toEqual([[usuario]]);
    expect(respuesta.clearCookie.mock.calls[0]).toEqual([
      COOKIE_REFRESH,
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/auth',
      }),
    ]);
    expect(respuesta.status.mock.calls[0]?.[0]).toBe(204);
    expect(respuesta.end.mock.calls).toHaveLength(1);
  });

  it('obtiene el perfil del usuario autenticado', async () => {
    const usuario = crearUsuario();
    const perfil = {
      id: 10,
      nombres: 'Empleado de prueba',
    };
    const obtenerPerfil = vi.fn().mockResolvedValue(perfil);
    const servicio = { obtenerPerfil } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();

    await ejecutarHandler(
      controller.me,
      { usuario } as unknown as Request,
      respuesta.res,
    );

    expect(obtenerPerfil.mock.calls).toEqual([[usuario]]);
    expect(respuesta.json.mock.calls[0]?.[0]).toEqual({ usuario: perfil });
  });

  it('rechaza la consulta del perfil cuando no existe un usuario autenticado', async () => {
    const obtenerPerfil = vi.fn();
    const servicio = { obtenerPerfil } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);

    await expect(
      ejecutarHandler(
        controller.me,
        { usuario: undefined } as unknown as Request,
        crearRespuesta().res,
      ),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });

    expect(obtenerPerfil.mock.calls).toHaveLength(0);
  });

  it('propaga los errores del servicio al consultar el perfil', async () => {
    const error = new Error('Perfil no disponible');
    const obtenerPerfil = vi.fn().mockRejectedValue(error);
    const servicio = { obtenerPerfil } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);

    await expect(
      ejecutarHandler(
        controller.me,
        { usuario: crearUsuario() } as unknown as Request,
        crearRespuesta().res,
      ),
    ).rejects.toBe(error);
  });

  it('propaga los errores del servicio al cerrar sesión', async () => {
    const error = new Error('No se pudo cerrar la sesión');
    const cerrarSesion = vi.fn().mockRejectedValue(error);
    const servicio = { cerrarSesion } as unknown as AuthService;
    const controller = crearAuthController(servicio, opciones);
    const respuesta = crearRespuesta();

    await expect(
      ejecutarHandler(
        controller.logout,
        { usuario: crearUsuario() } as unknown as Request,
        respuesta.res,
      ),
    ).rejects.toBe(error);

    expect(respuesta.clearCookie.mock.calls).toHaveLength(0);
  });
});