// Configuracion de Vitest del backend: entorno Node y cobertura v8 con LCOV para SonarCloud
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Todas las pruebas viven en tests/{unit,integration,e2e,performance}
    include: ['tests/**/*.test.ts'],
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