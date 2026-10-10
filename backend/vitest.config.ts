// Configuracion de Vitest del backend: entorno Node y cobertura v8 con LCOV para SonarCloud.
// Aqui corren las pruebas SIN servicios externos (unitarias y de modulos con dobles).
// Las que necesitan MySQL y Redis reales usan vitest.db.config.ts.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Todas las pruebas viven en tests/{unit,integration,e2e,performance}
    include: ['tests/**/*.test.ts'],
    // Las pruebas con base de datos real se ejecutan con npm run test:db
    exclude: [...configDefaults.exclude, 'tests/integration/repositorios/**', 'tests/e2e/**'],
    // Variables minimas para que config/env.ts valide al importarse en las pruebas
    env: {
      CORS_ORIGINS: 'http://localhost:5173',
      DB_HOST: 'localhost',
      DB_USER: 'usuario_pruebas',
      DB_PASSWORD: 'clave_pruebas',
      DB_NAME: 'base_pruebas',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'secreto-de-acceso-solo-para-pruebas-0001',
      JWT_REFRESH_SECRET: 'secreto-de-refresh-solo-para-pruebas-0002',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
    },
    coverage: {
      provider: 'v8',
      // lcov.info es el archivo que consume SonarCloud
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // El arranque del servidor y los scripts de linea de comandos se cubren con pruebas e2e
      exclude: ['src/server.ts', 'src/scripts/**'],
    },
  },
});