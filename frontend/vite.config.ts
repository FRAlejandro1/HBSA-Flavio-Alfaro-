// Configuracion de Vite y de Vitest en un solo archivo.
// En desarrollo, las llamadas a /api se reenvian al backend para evitar problemas de CORS.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // Lee .env sin filtrar por prefijo: DEV_PROXY_TARGET no se expone al navegador
  const entorno = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: entorno.DEV_PROXY_TARGET ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      // jsdom simula el navegador para Testing Library
      environment: 'jsdom',
      setupFiles: ['./tests/setup/setup.ts'],
      // Todas las pruebas viven en tests/{unit,integration,e2e,performance}
      include: ['tests/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        // lcov.info es el archivo que consume SonarCloud
        reporter: ['text', 'lcov'],
        reportsDirectory: 'coverage',
        include: ['src/**/*.{ts,tsx}'],
        // El punto de entrada y los tipos de Vite no tienen logica que probar
        exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
      },
    },
  };
});