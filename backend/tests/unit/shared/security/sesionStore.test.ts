import { beforeEach, describe, expect, it, vi } from 'vitest';

const { obtenerRedisMock, redisMock } = vi.hoisted(() => ({
  obtenerRedisMock: vi.fn(),
  redisMock: {
    set: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('../../../../src/config/redis', () => ({
  obtenerRedis: obtenerRedisMock,
}));

import { obtenerRedis } from '../../../../src/config/redis';
import { sesionStoreRedis } from '../../../../src/shared/security/sesionStore';

describe('sesionStoreRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerRedisMock.mockReturnValue(redisMock);
    redisMock.set.mockResolvedValue('OK');
    redisMock.exists.mockResolvedValue(0);
  });

  describe('revocarToken', () => {
    it('no consulta Redis cuando el TTL es cero', async () => {
      await expect(sesionStoreRedis.revocarToken('jti-1', 0)).resolves.toBeUndefined();

      expect(obtenerRedis).not.toHaveBeenCalled();
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('no consulta Redis cuando el TTL es negativo', async () => {
      await expect(sesionStoreRedis.revocarToken('jti-1', -10)).resolves.toBeUndefined();

      expect(obtenerRedis).not.toHaveBeenCalled();
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('guarda el token revocado con su prefijo y TTL redondeado hacia arriba', async () => {
      await sesionStoreRedis.revocarToken('jti-123', 10.2);

      expect(obtenerRedis).toHaveBeenCalledOnce();
      expect(redisMock.set).toHaveBeenCalledWith(
        'revocado:jti:jti-123',
        '1',
        'EX',
        11,
      );
    });

    it('propaga los errores de Redis al revocar un token', async () => {
      const error = new Error('Redis no disponible');
      redisMock.set.mockRejectedValueOnce(error);

      await expect(
        sesionStoreRedis.revocarToken('jti-123', 30),
      ).rejects.toBe(error);
    });
  });

  describe('estaRevocado', () => {
    it('devuelve true cuando Redis indica que el token existe', async () => {
      redisMock.exists.mockResolvedValueOnce(1);

      await expect(sesionStoreRedis.estaRevocado('jti-123')).resolves.toBe(true);

      expect(obtenerRedis).toHaveBeenCalledOnce();
      expect(redisMock.exists).toHaveBeenCalledWith('revocado:jti:jti-123');
    });

    it('devuelve false cuando Redis indica que el token no existe', async () => {
      redisMock.exists.mockResolvedValueOnce(0);

      await expect(sesionStoreRedis.estaRevocado('jti-456')).resolves.toBe(false);

      expect(redisMock.exists).toHaveBeenCalledWith('revocado:jti:jti-456');
    });

    it('propaga los errores de Redis al consultar un token', async () => {
      const error = new Error('Redis no disponible');
      redisMock.exists.mockRejectedValueOnce(error);

      await expect(sesionStoreRedis.estaRevocado('jti-123')).rejects.toBe(error);
    });
  });
});