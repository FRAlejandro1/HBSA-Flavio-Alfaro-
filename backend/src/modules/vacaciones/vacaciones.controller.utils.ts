import type { Request } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';

// Obtiene el actor autenticado; sin usuario, la sesión no es válida.
export function obtenerActor(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }

  return req.usuario;
}

// Lee el identificador validado por el middleware y conserva el comportamiento actual.
export function leerId(req: Request): number {
  const bruto: unknown = req.params.id;
  const id =
    typeof bruto === 'number'
      ? bruto
      : typeof bruto === 'string'
        ? Number.parseFloat(bruto)
        : Number.NaN;

  if (Number.isNaN(id)) {
    throw AppError.validacion('Identificador invalido');
  }

  return id;
}
