// Utilidades para leer datos de la peticion que comparten los controllers.
import type { Request } from 'express';
import { AppError } from '../errors/AppError';
import type { UsuarioAutenticado } from '../types/autenticacion';

// Devuelve el usuario que dejo authenticate; falla si la ruta no estaba protegida
export function exigirUsuario(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

// validate ya convirtio el id de la URL en numero; aqui solo se lee con el tipo correcto
export function leerIdParametro(req: Request): number {
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