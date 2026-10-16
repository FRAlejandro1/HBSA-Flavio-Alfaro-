// Cliente de Redis para la sesion: blacklist de jti y datos temporales.
// Nunca se guardan aqui datos sensibles.
import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// Instancia unica, creada la primera vez que se pide
let cliente: Redis | undefined;

export function obtenerRedis(): Redis {
  if (!cliente) {
    cliente = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
    cliente.on('error', (error: Error) => {
      logger.error('Error de Redis', { mensaje: error.message });
    });
    cliente.on('ready', () => {
      logger.info('Redis listo');
    });
  }
  return cliente;
}

// Comprobacion de salud: falla si Redis no responde
export async function verificarRedis(): Promise<void> {
  const respuesta = await obtenerRedis().ping();
  if (respuesta !== 'PONG') {
    throw new Error('Redis no respondio al ping');
  }
}

// Cierra la conexion al apagar el servidor
export async function cerrarRedis(): Promise<void> {
  if (cliente) {
    await cliente.quit();
    cliente = undefined;
  }
}