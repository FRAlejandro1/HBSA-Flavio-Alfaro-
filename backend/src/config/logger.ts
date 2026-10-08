// Logger estructurado con Winston: una linea JSON por evento, apta para diagnostico y auditoria.
// En pruebas se silencia para no ensuciar la salida.
import { createLogger, format, transports } from 'winston';
import { env } from './env';

export const logger = createLogger({
  level: env.LOG_LEVEL,
  silent: env.NODE_ENV === 'test',
  // Marca de tiempo, traza de pila en errores y salida en JSON
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { servicio: 'hbsa-backend' },
  transports: [new transports.Console()],
});