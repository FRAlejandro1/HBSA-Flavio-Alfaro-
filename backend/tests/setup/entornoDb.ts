// Parametros de las pruebas contra MySQL y Redis reales.
// Se usan exclusivamente variables TEST_* para no reutilizar la configuracion de desarrollo.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const posiblesArchivosEntorno = [
  path.resolve(process.cwd(), '.env.test'),
  path.resolve(process.cwd(), 'backend/.env.test'),
];

const archivoEntornoPruebas = posiblesArchivosEntorno.find((archivo) =>
  existsSync(archivo),
);

function leerClaveLocal(nombre: string): string | undefined {
  if (!archivoEntornoPruebas) {
    return undefined;
  }

  const lineas = readFileSync(archivoEntornoPruebas, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);

  const linea = lineas.find((contenido) =>
    new RegExp(`^\\s*${nombre}\\s*=`).test(contenido),
  );

  if (!linea) {
    return undefined;
  }

  let valor = linea.slice(linea.indexOf('=') + 1).trim();

  if (
    valor.length >= 2 &&
    ((valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'")))
  ) {
    valor = valor.slice(1, -1);
  }

  return valor || undefined;
}

function leer(nombre: string, porDefecto: string): string {
  return process.env[nombre] ?? porDefecto;
}

const password =
  process.env.TEST_DB_PASSWORD ?? leerClaveLocal('TEST_DB_PASSWORD');

if (!password) {
  throw new Error(
    'Falta TEST_DB_PASSWORD. Configurala en el entorno o en backend/.env.test.',
  );
}

const puerto = Number(leer('TEST_DB_PORT', '3307'));

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  throw new Error('TEST_DB_PORT debe ser un puerto entero entre 1 y 65535.');
}

const nombreBase = leer('TEST_DB_NAME', 'hbsa_vacaciones_test');

if (!nombreBase.endsWith('_test')) {
  throw new Error(
    `Por seguridad, las pruebas requieren una base terminada en _test. Recibida: ${nombreBase}`,
  );
}

export const conexionPruebas = {
  host: leer('TEST_DB_HOST', '127.0.0.1'),
  port: puerto,
  user: leer('TEST_DB_USER', 'hbsa_app'),
  password,
  database: nombreBase,
};

// Base 1 de Redis, separada de la base 0 utilizada habitualmente en desarrollo.
export const redisPruebas = leer(
  'TEST_REDIS_URL',
  'redis://127.0.0.1:6379/1',
);

// Variables de entorno que recibe la aplicacion durante estas pruebas.
export const variablesApp: Record<string, string> = {
  NODE_ENV: 'test',
  CORS_ORIGINS: 'http://localhost:5173',
  DB_HOST: conexionPruebas.host,
  DB_PORT: String(conexionPruebas.port),
  DB_USER: conexionPruebas.user,
  DB_PASSWORD: conexionPruebas.password,
  DB_NAME: conexionPruebas.database,
  REDIS_URL: redisPruebas,
  JWT_ACCESS_SECRET: 'secreto-de-acceso-solo-para-pruebas-0001',
  JWT_REFRESH_SECRET: 'secreto-de-refresh-solo-para-pruebas-0002',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
};
