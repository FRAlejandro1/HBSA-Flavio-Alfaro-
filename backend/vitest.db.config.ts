// Configuracion de Vitest para las pruebas con MySQL y Redis REALES:
// repositorios (SQL, claves foraneas, duplicados) y E2E de la app completa.
// Antes de correr, globalSetupDb recrea el esquema de la base de pruebas desde cero.
import { configDefaults, defineConfig } from 'vitest/config';
import { variablesApp } from './tests/setup/entornoDb';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/repositorios/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    exclude: configDefaults.exclude,
    globalSetup: ['./tests/setup/globalSetupDb.ts'],
    // Variables que ve config/env.ts: apuntan a la base y a Redis de pruebas
    env: variablesApp,
    // Los archivos comparten la misma base de datos: se ejecutan de uno en uno
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Dentro de coverage/ para que .gitignore ya lo cubra
      reportsDirectory: 'coverage/db',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/scripts/**'],
    },
  },
});