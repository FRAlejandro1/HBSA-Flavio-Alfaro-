// Composicion del modulo: conecta las implementaciones reales (MySQL, Redis, Argon2, jose)
// y devuelve el router listo para montar en app.ts. Es el unico lugar que las conoce.
import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { env } from '../../config/env';
import { limitadorAutenticacion } from '../../config/rateLimit';
import { authenticate } from '../../middlewares/authenticate';
import { sesionStoreRedis } from '../../shared/security/sesionStore';
import { TTL_ACCESO_SEGUNDOS, TTL_REFRESH_SEGUNDOS, tokensJwt } from '../../shared/security/tokens';
import { crearAuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { crearAuthRouter } from './auth.routes';
import { AuthService, clavesArgon2 } from './auth.service';

export function crearRouterAuth(): Router {
  const servicio = new AuthService({
    repositorio: new AuthRepository(obtenerBaseDatos()),
    tokens: tokensJwt,
    claves: clavesArgon2,
    sesiones: sesionStoreRedis,
    ttlAccesoSegundos: TTL_ACCESO_SEGUNDOS,
  });

  const controller = crearAuthController(servicio, {
    secure: env.COOKIE_SECURE,
    ttlRefreshSegundos: TTL_REFRESH_SEGUNDOS,
  });

  return crearAuthRouter({ controller, autenticar: authenticate, limitadorAutenticacion });
}