// Arranque del servidor HTTP y cierre ordenado (SIGINT y SIGTERM).
// Al apagar deja de aceptar conexiones y cierra MySQL y Redis antes de salir.
import type { Server } from 'node:http';
import { crearApp } from './app';
import { cerrarBaseDatos } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { cerrarRedis } from './config/redis';

const TIEMPO_MAXIMO_APAGADO_MS = 10_000;

const servidor: Server = crearApp().listen(env.PORT, () => {
  logger.info('Servidor escuchando', { puerto: env.PORT, entorno: env.NODE_ENV });
});

let apagando = false;

async function apagar(senal: string): Promise<void> {
  if (apagando) {
    return;
  }
  apagando = true;
  logger.info('Apagando servidor', { senal });

  // Si algo se cuelga, se fuerza la salida pasado el tiempo maximo
  setTimeout(() => {
    logger.error('Apagado forzado por tiempo agotado');
    process.exit(1);
  }, TIEMPO_MAXIMO_APAGADO_MS).unref();

  try {
    await new Promise<void>((resolver, rechazar) => {
      servidor.close((error) => {
        if (error) {
          rechazar(error);
        } else {
          resolver();
        }
      });
    });
    await cerrarBaseDatos();
    await cerrarRedis();
    process.exit(0);
  } catch (error) {
    logger.error('Error al apagar el servidor', {
      detalle: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void apagar('SIGINT');
});
process.on('SIGTERM', () => {
  void apagar('SIGTERM');
});
process.on('unhandledRejection', (motivo) => {
  logger.error('Promesa rechazada sin manejar', { motivo: String(motivo) });
});