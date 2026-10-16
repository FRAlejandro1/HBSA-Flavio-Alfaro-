// Traduce HTTP a llamadas del service: lee la peticion, invoca y responde. No contiene reglas de negocio.
// Maneja las cookies: el refresh token solo viaja en una cookie httpOnly y nunca en el cuerpo.
import type { CookieOptions, Request, RequestHandler } from 'express';
import { COOKIE_CSRF, generarTokenCsrf } from '../../middlewares/csrf';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type { AuthService } from './auth.service';
import type { LoginEntrada } from './auth.validators';

export const COOKIE_REFRESH = 'hbsa_refresh';
// La cookie del refresh solo se envia a las rutas de autenticacion
const RUTA_COOKIE_REFRESH = '/api/auth';

export interface OpcionesCookies {
  // true en produccion: las cookies solo viajan por HTTPS
  secure: boolean;
  ttlRefreshSegundos: number;
}

export interface AuthController {
  obtenerCsrf: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
}

// Devuelve el usuario que dejo authenticate; falla si la ruta no estaba protegida
function exigirUsuario(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

export function crearAuthController(servicio: AuthService, opciones: OpcionesCookies): AuthController {
  // Base comun: inaccesible desde JavaScript y nunca enviada desde otro sitio
  const baseCookie: CookieOptions = { httpOnly: true, secure: opciones.secure, sameSite: 'strict' };
  const cookieRefresh: CookieOptions = {
    ...baseCookie,
    path: RUTA_COOKIE_REFRESH,
    maxAge: opciones.ttlRefreshSegundos * 1000,
  };
  const cookieCsrf: CookieOptions = { ...baseCookie, path: '/' };

  return {
    // Entrega el token CSRF en el cuerpo y en una cookie; el cliente lo repite en X-CSRF-Token
    obtenerCsrf: (_req, res) => {
      const token = generarTokenCsrf();
      res.cookie(COOKIE_CSRF, token, cookieCsrf);
      res.json({ csrfToken: token });
    },

    login: async (req, res) => {
      const { correo, clave } = req.body as LoginEntrada;
      const resultado = await servicio.login(correo, clave);
      res.cookie(COOKIE_REFRESH, resultado.refreshToken, cookieRefresh);
      res.json({
        accessToken: resultado.accessToken,
        expiraEn: resultado.expiraEn,
        usuario: resultado.usuario,
      });
    },

    refresh: async (req, res) => {
      const cookies = req.cookies as Record<string, string | undefined> | undefined;
      const refreshToken = cookies?.[COOKIE_REFRESH];
      if (!refreshToken) {
        throw AppError.noAutenticado();
      }
      const resultado = await servicio.refrescar(refreshToken);
      res.cookie(COOKIE_REFRESH, resultado.refreshToken, cookieRefresh);
      res.json({ accessToken: resultado.accessToken, expiraEn: resultado.expiraEn });
    },

    logout: async (req, res) => {
      await servicio.cerrarSesion(exigirUsuario(req));
      res.clearCookie(COOKIE_REFRESH, { ...baseCookie, path: RUTA_COOKIE_REFRESH });
      res.status(204).end();
    },

    me: async (req, res) => {
      const usuario = await servicio.obtenerPerfil(exigirUsuario(req));
      res.json({ usuario });
    },
  };
}