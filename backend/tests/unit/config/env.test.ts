// Pruebas de config/env: conversion de tipos y rechazo de configuraciones invalidas.
import { describe, expect, it } from 'vitest';
import { cargarEnv } from '../../../src/config/env';

// Configuracion valida de referencia; cada prueba cambia solo lo que necesita
const base: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  CORS_ORIGINS: 'http://localhost:5173, https://vacaciones.example.com',
  DB_HOST: 'localhost',
  DB_USER: 'usuario',
  DB_PASSWORD: 'clave',
  DB_NAME: 'base_pruebas',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
};

describe('cargarEnv', () => {
  it('convierte los tipos y aplica los valores por defecto', () => {
    const env = cargarEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.DB_PORT).toBe(3306);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.DIAS_VACACIONES_ANUALES).toBe(30);
  });

  it('divide CORS_ORIGINS en una lista sin espacios', () => {
    const env = cargarEnv(base);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://vacaciones.example.com']);
  });

  it('interpreta COOKIE_SECURE=true como booleano', () => {
    const env = cargarEnv({ ...base, COOKIE_SECURE: 'true' });
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('rechaza una variable obligatoria ausente y la nombra en el error', () => {
    expect(() => cargarEnv({ ...base, DB_HOST: undefined })).toThrow(/DB_HOST/);
  });

  it('rechaza secretos JWT de menos de 32 caracteres', () => {
    expect(() => cargarEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rechaza secretos JWT iguales', () => {
    expect(() => cargarEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('exige COOKIE_SECURE=true en produccion', () => {
    expect(() => cargarEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });
});