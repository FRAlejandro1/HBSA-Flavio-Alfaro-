// Proteccion CSRF por doble envio: el token viaja en una cookie y debe repetirse en la cabecera
// X-CSRF-Token. Un sitio atacante puede hacer que el navegador envie la cookie, pero no puede leerla
// para copiarla en la cabecera. Solo se exige en metodos que cambian estado.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/AppError';

export const COOKIE_CSRF = 'hbsa_csrf';
export const CABECERA_CSRF = 'x-csrf-token';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Token aleatorio de 256 bits en base64url
export function generarTokenCsrf(): string {
  return randomBytes(32).toString('base64url');
}

// Comparacion en tiempo constante para no filtrar informacion por el tiempo de respuesta
function sonIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export const csrf: RequestHandler = (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) {
    next();
    return;
  }

  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const deCookie = cookies?.[COOKIE_CSRF];
  const deCabecera = req.get(CABECERA_CSRF);

  if (!deCookie || !deCabecera || !sonIguales(deCookie, deCabecera)) {
    next(AppError.prohibido('Token CSRF invalido o ausente'));
    return;
  }
  next();
};