// Limites de peticiones por ruta, con Redis o memoria segun se defina mas adelante.
// Hoy usan memoria del proceso: suficiente para una sola instancia.
import { rateLimit } from 'express-rate-limit';
import { env } from './env';

// Cuerpo de respuesta al superar el limite
const respuestaLimite = {
  codigo: 'DEMASIADAS_PETICIONES',
  mensaje: 'Demasiadas peticiones, intenta de nuevo mas tarde',
};

// Limite general para toda la API
export const limitadorGeneral = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: respuestaLimite,
});

// Limite estricto para login y refresh: solo cuentan los intentos fallidos
export const limitadorAutenticacion = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: respuestaLimite,
});