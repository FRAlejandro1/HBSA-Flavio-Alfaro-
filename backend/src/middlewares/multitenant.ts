// Aislamiento por hospital: toma el empresa_id del token y lo deja en req.empresaId.
// Controllers y services lo leen con obtenerEmpresaId; nunca aceptan un empresa_id del body, query o URL.
import type { Request, RequestHandler } from 'express';
import { AppError } from '../shared/errors/AppError';

export const multitenant: RequestHandler = (req, _res, next) => {
  if (!req.usuario) {
    next(AppError.noAutenticado());
    return;
  }
  req.empresaId = req.usuario.empresaId;
  next();
};

// Devuelve el hospital de la peticion; falla si multitenant no se ejecuto antes
export function obtenerEmpresaId(req: Request): number {
  if (req.empresaId === undefined) {
    throw AppError.noAutenticado();
  }
  return req.empresaId;
}