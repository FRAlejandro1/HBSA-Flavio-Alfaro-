// Configuracion de Vitest del backend: entorno Node y cobertura v8 con LCOV para SonarCloud
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Todas las pruebas viven en tests/{unit,integration,e2e,performance}
    include: ['tests/**/*.test.ts'],
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
      // El arranque del servidor se cubre con pruebas e2e, no con unitarias
      exclude: ['src/server.ts'],
    },
  },
});