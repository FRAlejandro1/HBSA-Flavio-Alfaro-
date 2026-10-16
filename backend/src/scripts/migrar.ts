// Comando para migrar la base de datos: desarrollo, pruebas o produccion.
// Uso: npm run migrar:local -w backend -- [todo|migraciones|seeds] [--demo] [--reiniciar]
// En produccion: node dist/scripts/migrar.js migraciones  (y luego "seeds" para los datos base)
// Lee la conexion de DB_*; si existe MIGRACION_DB_USER usa ese usuario (con permisos de DDL).
import path from 'node:path';
import { ZodError, z } from 'zod';
import { ejecutarMigracion } from './migrador';
import type { ModoMigracion } from './migrador';

const esquemaEntorno = z.object({
  NODE_ENV: z.string().default('development'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  MIGRACION_DB_USER: z.string().min(1).optional(),
  MIGRACION_DB_PASSWORD: z.string().min(1).optional(),
  // Carpeta database/ del repositorio; por defecto se calcula desde la ubicacion de este archivo
  DATABASE_SQL_DIR: z.string().min(1).optional(),
});

function esModo(valor: string): valor is ModoMigracion {
  return valor === 'todo' || valor === 'migraciones' || valor === 'seeds';
}

async function principal(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const modoPedido = argumentos.find((argumento) => !argumento.startsWith('--')) ?? 'todo';
  if (!esModo(modoPedido)) {
    throw new Error('Uso: migrar [todo|migraciones|seeds] [--demo] [--reiniciar]');
  }
  const incluirDemo = argumentos.includes('--demo');
  const reiniciar = argumentos.includes('--reiniciar');

  const entorno = esquemaEntorno.parse(process.env);
  if (entorno.NODE_ENV === 'production' && (incluirDemo || reiniciar)) {
    throw new Error('En produccion no se permiten --demo ni --reiniciar');
  }

  const usuario = entorno.MIGRACION_DB_USER ?? entorno.DB_USER;
  const clave =
    entorno.MIGRACION_DB_USER === undefined ? entorno.DB_PASSWORD : entorno.MIGRACION_DB_PASSWORD;
  if (clave === undefined) {
    throw new Error('MIGRACION_DB_PASSWORD es obligatoria cuando se define MIGRACION_DB_USER');
  }

  process.stdout.write(`Migrando ${entorno.DB_NAME} en ${entorno.DB_HOST} (${modoPedido})\n`);
  const resultado = await ejecutarMigracion({
    conexion: {
      host: entorno.DB_HOST,
      port: entorno.DB_PORT,
      user: usuario,
      password: clave,
      database: entorno.DB_NAME,
    },
    directorioSql: entorno.DATABASE_SQL_DIR ?? path.resolve(__dirname, '../../../database'),
    modo: modoPedido,
    incluirDemo,
    reiniciar,
  });

  const mostrar = (titulo: string, nombres: string[]): void => {
    process.stdout.write(`${titulo}: ${nombres.length > 0 ? nombres.join(', ') : 'ninguna'}\n`);
  };
  mostrar('Migraciones aplicadas', resultado.migraciones);
  mostrar('Seeds cargados', resultado.seeds);
}

// Resume el error para la terminal sin imprimir datos sensibles
function describirError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`).join('\n');
  }
  return error instanceof Error ? error.message : String(error);
}

principal().catch((error: unknown) => {
  process.stderr.write(`No se pudo migrar:\n${describirError(error)}\n`);
  process.exitCode = 1;
});