// Filtrado por rol: deja pasar solo a los roles indicados. Va despues de authenticate.
import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/AppError';
import type { CodigoRol } from '../shared/types/roles';

export function authorizeRole(...permitidos: readonly CodigoRol[]): RequestHandler {
  const roles = new Set<CodigoRol>(permitidos);

  return (req, _res, next) => {
    if (!req.usuario) {
      next(AppError.noAutenticado());
      return;
    }
    if (!roles.has(req.usuario.rol)) {
      next(AppError.prohibido());
      return;
    }
    next();
  };
}