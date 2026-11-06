// Pruebas unitarias del cliente Redis.
// Verifica inicializacion, eventos, disponibilidad y cierre de conexion.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const cliente = {
    on: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
  };

  return {
    cliente,
    Redis: vi.fn(() => cliente),
    logger: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('ioredis', () => ({
  Redis: mocks.Redis,
}));

vi.mock('../../../src/config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('../../../src/config/logger', () => ({
  logger: mocks.logger,
}));

describe('cliente Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.Redis.mockImplementation(() => mocks.cliente);
    mocks.cliente.ping.mockResolvedValue('PONG');
    mocks.cliente.quit.mockResolvedValue('OK');
  });

  it('crea el cliente una sola vez y registra sus eventos', async () => {
    const { obtenerRedis } = await import('../../../src/config/redis');

    const primero = obtenerRedis();
    const segundo = obtenerRedis();

    expect(primero).toBe(mocks.cliente);
    expect(segundo).toBe(primero);
    expect(mocks.Redis).toHaveBeenCalledTimes(1);
    expect(mocks.Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    });
    expect(mocks.cliente.on).toHaveBeenCalledTimes(2);
    expect(mocks.cliente.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mocks.cliente.on).toHaveBeenCalledWith('ready', expect.any(Function));
  });

  it('registra los errores de conexion en el logger', async () => {
    const { obtenerRedis } = await import('../../../src/config/redis');

    obtenerRedis();

    const manejador = mocks.cliente.on.mock.calls.find(
      ([evento]) => evento === 'error',
    )?.[1] as (error: Error) => void;

    manejador(new Error('conexion rechazada'));

    expect(mocks.logger.error).toHaveBeenCalledWith('Error de Redis', {
      mensaje: 'conexion rechazada',
    });
  });

  it('registra cuando Redis esta listo', async () => {
    const { obtenerRedis } = await import('../../../src/config/redis');

    obtenerRedis();

    const manejador = mocks.cliente.on.mock.calls.find(
      ([evento]) => evento === 'ready',
    )?.[1] as () => void;

    manejador();

    expect(mocks.logger.info).toHaveBeenCalledWith('Redis listo');
  });

  it('verifica correctamente una respuesta PONG', async () => {
    const { verificarRedis } = await import('../../../src/config/redis');

    await expect(verificarRedis()).resolves.toBeUndefined();

    expect(mocks.Redis).toHaveBeenCalledTimes(1);
    expect(mocks.cliente.ping).toHaveBeenCalledOnce();
  });

  it('lanza un error cuando Redis no responde PONG', async () => {
    mocks.cliente.ping.mockResolvedValue('ERROR');

    const { verificarRedis } = await import('../../../src/config/redis');

    await expect(verificarRedis()).rejects.toThrow(
      'Redis no respondio al ping',
    );
  });

  it('propaga los errores producidos al ejecutar ping', async () => {
    mocks.cliente.ping.mockRejectedValue(new Error('timeout'));

    const { verificarRedis } = await import('../../../src/config/redis');

    await expect(verificarRedis()).rejects.toThrow('timeout');
  });

  it('cierra la conexion y permite crear un nuevo cliente', async () => {
    const { obtenerRedis, cerrarRedis } = await import('../../../src/config/redis');

    obtenerRedis();
    await cerrarRedis();

    expect(mocks.cliente.quit).toHaveBeenCalledOnce();

    obtenerRedis();

    expect(mocks.Redis).toHaveBeenCalledTimes(2);
  });

  it('no intenta cerrar una conexion que nunca fue inicializada', async () => {
    const { cerrarRedis } = await import('../../../src/config/redis');

    await expect(cerrarRedis()).resolves.toBeUndefined();

    expect(mocks.cliente.quit).not.toHaveBeenCalled();
    expect(mocks.Redis).not.toHaveBeenCalled();
  });

  it('conserva el cliente si falla el cierre de la conexion', async () => {
    mocks.cliente.quit.mockRejectedValue(new Error('no se pudo cerrar'));

    const { obtenerRedis, cerrarRedis } = await import('../../../src/config/redis');

    const cliente = obtenerRedis();

    await expect(cerrarRedis()).rejects.toThrow('no se pudo cerrar');

    expect(obtenerRedis()).toBe(cliente);
    expect(mocks.Redis).toHaveBeenCalledOnce();
  });
});
