// Composicion de Express: seguridad, parseo, rutas y manejo de errores, en ese orden.
// No arranca el servidor (eso lo hace server.ts), asi las pruebas importan la app sin abrir puertos.
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import { middlewareCors } from './config/cors';
import { middlewareHelmet } from './config/helmet';
import { limitadorGeneral } from './config/rateLimit';
import { errorHandler, rutaNoEncontrada } from './middlewares/errorHandler';

export function crearApp(): Express {
  const app = express();

  // No anunciar que el servidor usa Express
  app.disable('x-powered-by');

  // Cabeceras de seguridad, CORS y limite general de peticiones
  app.use(middlewareHelmet);
  app.use(middlewareCors);
  app.use(limitadorGeneral);

  // Lectura de JSON (con tope de tamano) y de cookies (refresh token)
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Comprobacion de vida: la usan Docker y el monitoreo
  app.get('/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });

  // Aqui se montaran los modulos: /api/auth, /api/usuarios, ...

  // Siempre al final: 404 y manejo de errores
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  return app;
}