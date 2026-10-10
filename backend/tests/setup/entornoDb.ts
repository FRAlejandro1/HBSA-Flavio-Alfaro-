// Parametros de las pruebas contra MySQL y Redis reales.
// Se leen de variables TEST_* (nunca de DB_*), asi una prueba jamas toca la base de desarrollo o de produccion.
// Los valores por defecto coinciden con docker-compose.yml.

function leer(nombre: string, porDefecto: string): string {
  return process.env[nombre] ?? porDefecto;
}

export const conexionPruebas = {
  host: leer('TEST_DB_HOST', 'localhost'),
  port: Number.parseFloat(leer('TEST_DB_PORT', '3306')),
  user: leer('TEST_DB_USER', 'hbsa_app'),
  password: leer('TEST_DB_PASSWORD', 'cambia-esta-clave'),
  database: leer('TEST_DB_NAME', 'hbsa_vacaciones_test'),
};

// Base 1 de Redis, separada de la 0 que usa el desarrollo
export const redisPruebas = leer('TEST_REDIS_URL', 'redis://localhost:6379/1');

// Variables de entorno que ve el codigo de la aplicacion (config/env.ts) durante estas pruebas
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