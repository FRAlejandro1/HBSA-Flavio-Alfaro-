// Preparacion global de las pruebas: matchers de jest-dom y limpieza del DOM entre pruebas.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin globals de Vitest, Testing Library no limpia solo: se registra aqui
afterEach(() => {
  cleanup();
});