// Arranque del servidor HTTP, procesamiento periódico de vencimientos y cierre ordenado.
// Al apagar, detiene el procesamiento automático y cierra MySQL y Redis.
import type { Server } from 'node:http';
import { crearAppConServicios } from './app';
import { cerrarBaseDatos } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { cerrarRedis } from './config/redis';

const TIEMPO_MAXIMO_APAGADO_MS = 10_000;
const INTERVALO_ESCALAMIENTOS_MS = 60_000;

const { app, vacaciones } = crearAppConServicios();

const servidor: Server = app.listen(env.PORT, () => {
  logger.info('Servidor escuchando', {
    puerto: env.PORT,
    entorno: env.NODE_ENV,
  });
});

let apagando = false;
let ejecucionEscalamientos: Promise<void> | null = null;

function ejecutarEscalamientos(): Promise<void> {
  if (apagando) {
    return Promise.resolve();
  }

  // Evita que un nuevo ciclo se ejecute mientras el anterior sigue activo.
  if (ejecucionEscalamientos !== null) {
    return ejecucionEscalamientos;
  }

  ejecucionEscalamientos = (async () => {
    try {
      const cantidad = await vacaciones.procesarEscalamientosVencidos();

      if (cantidad > 0) {
        logger.info('Procesamiento de vencimientos finalizado', {
          cantidadEscalada: cantidad,
        });
      }
    } catch (error) {
      // Un fallo del procesador no debe detener el servidor ni los siguientes ciclos.
      logger.error('Error al procesar escalamientos por vencimiento', {
        detalle: error instanceof Error ? error.message : String(error),
      });
    } finally {
      ejecucionEscalamientos = null;
    }
  })();

  return ejecucionEscalamientos;
}

// Revisar los vencimientos al iniciar y repetir la revisión cada 60 segundos.
void ejecutarEscalamientos();

const temporizadorEscalamientos = setInterval(() => {
  void ejecutarEscalamientos();
}, INTERVALO_ESCALAMIENTOS_MS);

// El temporizador no debe impedir que el proceso termine durante el apagado.
temporizadorEscalamientos.unref();

async function apagar(senal: string): Promise<void> {
  if (apagando) {
    return;
  }

  apagando = true;

  logger.info('Apagando servidor', { senal });

  // Detener nuevas ejecuciones y limitar el tiempo total de apagado.
  if (temporizadorEscalamientos !== undefined) {
    clearInterval(temporizadorEscalamientos);
  }

  setTimeout(() => {
    logger.error('Apagado forzado por tiempo agotado');
    process.exit(1);
  }, TIEMPO_MAXIMO_APAGADO_MS).unref();

  try {
    // Esperar el ciclo activo antes de cerrar los recursos que utiliza.
    if (ejecucionEscalamientos !== null) {
      await ejecucionEscalamientos;
    }

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
  logger.error('Promesa rechazada sin manejar', {
    motivo: String(motivo),
  });
});
