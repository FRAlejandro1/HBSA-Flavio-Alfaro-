// Politica CORS centralizada: solo los origenes de CORS_ORIGINS pueden llamar a la API con cookies.
import cors from 'cors';
import type { CorsOptions } from 'cors';
import { env } from './env';

const origenesPermitidos = new Set(env.CORS_ORIGINS);

export const opcionesCors: CorsOptions = {
  origin: (origen, devolver) => {
    // Sin cabecera Origin (herramientas de servidor, mismo origen) se permite el paso
    if (origen === undefined || origenesPermitidos.has(origen)) {
      devolver(null, true);
      return;
    }
    // Origen no listado: se responde sin cabeceras CORS y el navegador lo bloquea
    devolver(null, false);
  },
  // Necesario para enviar la cookie httpOnly del refresh token
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  // El navegador puede guardar la respuesta del preflight por 10 minutos
  maxAge: 600,
};

export const middlewareCors = cors(opcionesCors);