// Pruebas de Variables: lectura de numeros y valores tomados del entorno.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerNumero } from '@/config/Variables';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('leerNumero', () => {
  it('convierte un texto numerico', () => {
    expect(leerNumero('2500', 10)).toBe(2500);
  });

  it('devuelve el valor por defecto si falta', () => {
    expect(leerNumero(undefined, 10)).toBe(10);
  });

  it('devuelve el valor por defecto si no es un numero', () => {
    expect(leerNumero('abc', 10)).toBe(10);
  });
});

describe('Variables', () => {
  it('toma la URL de la API desde el entorno', async () => {
    vi.stubEnv('VITE_API_URL', '/otra-api');
    const { Variables } = await import('@/config/Variables');
    expect(Variables.apiUrl).toBe('/otra-api');
  });

  it('toma el tiempo de cache desde el entorno', async () => {
    vi.stubEnv('VITE_CACHE_TIEMPO_MS', '5000');
    const { Variables } = await import('@/config/Variables');
    expect(Variables.cacheTiempoMs).toBe(5000);
  });
});