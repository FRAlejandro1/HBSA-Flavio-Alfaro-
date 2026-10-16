// Pruebas de password: Argon2id, sal aleatoria y verificacion segura.
import { describe, expect, it } from 'vitest';
import {
  gastarTiempoDeVerificacion,
  hashearClave,
  verificarClave,
} from '../../../src/shared/security/password';

describe('password', () => {
  it('genera un hash Argon2id', async () => {
    const hash = await hashearClave('una-clave-segura-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('genera hashes distintos para la misma clave (sal aleatoria)', async () => {
    const primero = await hashearClave('una-clave-segura-123');
    const segundo = await hashearClave('una-clave-segura-123');
    expect(primero).not.toBe(segundo);
  });

  it('acepta la clave correcta', async () => {
    const hash = await hashearClave('una-clave-segura-123');
    expect(await verificarClave(hash, 'una-clave-segura-123')).toBe(true);
  });

  it('rechaza una clave incorrecta y un hash danado sin lanzar errores', async () => {
    const hash = await hashearClave('una-clave-segura-123');
    expect(await verificarClave(hash, 'otra-clave')).toBe(false);
    expect(await verificarClave('esto-no-es-un-hash', 'una-clave-segura-123')).toBe(false);
  });

  it('gasta tiempo de verificacion sin fallar', async () => {
    await expect(gastarTiempoDeVerificacion('cualquier-clave')).resolves.toBeUndefined();
  });
});