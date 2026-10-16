// Verifica el token de acceso (cabecera Authorization: Bearer ...), comprueba que no este revocado
// en Redis y deja el usuario en req.usuario. Las rutas protegidas lo usan antes que cualquier otro middleware.
import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/AppError';
import type { ISesionStore } from '../shared/security/sesionStore';
import { sesionStoreRedis } from '../shared/security/sesionStore';
import { tokensJwt } from '../shared/security/tokens';
import type { UsuarioAutenticado } from '../shared/types/autenticacion';

// Fabrica con dependencias inyectadas: asi se prueba sin Redis ni claves reales
export function crearAuthenticate(
  verificar: (token: string) => Promise<UsuarioAutenticado>,
  store: ISesionStore,
): RequestHandler {
  return async (req, _res, next) => {
    const partes = req.get('authorization')?.split(' ') ?? [];
    const esquema = partes[0];
    const token = partes[1];

    if (esquema !== 'Bearer' || !token) {
      next(AppError.noAutenticado());
      return;
    }

    // Lanza noAutenticado si la firma, el vencimiento o la forma del token no son validos
    const usuario = await verificar(token);

    if (await store.estaRevocado(usuario.jti)) {
      next(AppError.noAutenticado('Sesion cerrada'));
      return;
    }

    req.usuario = usuario;
    next();
  };
}

export const authenticate = crearAuthenticate(tokensJwt.verificarAcceso, sesionStoreRedis);