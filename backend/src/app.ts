// Composición de Express: seguridad, parseo, rutas y manejo de errores, en ese orden.
// No arranca el servidor; eso corresponde a server.ts, para permitir importar la aplicación en las pruebas.
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import { middlewareCors } from './config/cors';
import { env } from './config/env';
import { middlewareHelmet } from './config/helmet';
import { limitadorGeneral } from './config/rateLimit';
import { csrf } from './middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from './middlewares/errorHandler';
import { crearRouterAuth } from './modules/auth/auth.modulo';
import { crearRouterImportacion } from './modules/importacion/importacion.modulo';
import { crearRouterOrganizacion } from './modules/organizacion/organizacion.modulo';
import { crearRouterUsuarios } from './modules/usuarios/usuarios.modulo';
import { crearModuloVacaciones } from './modules/vacaciones/vacaciones.modulo';
import type { VacacionesService } from './modules/vacaciones/vacaciones.service';

export interface AplicacionConServicios {
  app: Express;
  vacaciones: VacacionesService;
}

export function crearAppConServicios(): AplicacionConServicios {
  const app = express();

  // No anunciar que el servidor utiliza Express.
  app.disable('x-powered-by');

  // Detrás de Nginx, la IP del usuario llega en X-Forwarded-For; con 0 esa cabecera se ignora.
  app.set('trust proxy', env.TRUST_PROXY);

  // Cabeceras de seguridad, CORS y límite general de peticiones.
  app.use(middlewareHelmet);
  app.use(middlewareCors);
  app.use(limitadorGeneral);

  // Lectura de JSON con límite de tamaño y de cookies para refresh y CSRF.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Comprobación de vida utilizada por Docker y el monitoreo.
  app.get('/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });

  // CSRF en los métodos que modifican el estado de la API; GET, HEAD y OPTIONS pasan libres.
  app.use('/api', (req, res, next) => {
    const esImportacion =
      req.path === '/importacion' || req.path.startsWith('/importacion/');

    if (esImportacion) {
      next();
      return;
    }

    csrf(req, res, next);
  });

  // Crear el módulo una sola vez permite compartir el servicio con el procesador automático.
  const moduloVacaciones = crearModuloVacaciones();

  // Módulos de dominio.
  app.use('/api/auth', crearRouterAuth());
  app.use('/api/organizacion', crearRouterOrganizacion());
  app.use('/api/usuarios', crearRouterUsuarios());
  app.use('/api/vacaciones', moduloVacaciones.router);
  app.use('/api/importacion', crearRouterImportacion());

  // Siempre al final: respuesta 404 y manejo de errores.
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  return {
    app,
    vacaciones: moduloVacaciones.servicio,
  };
}

export function crearApp(): Express {
  return crearAppConServicios().app;
}
