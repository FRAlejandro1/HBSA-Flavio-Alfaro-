// Pruebas unitarias del acceso a MySQL.
// Verifica consultas, ejecuciones, transacciones, salud y ciclo de vida del pool.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const conexion = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    execute: vi.fn(),
  };

  const pool = {
    pool: {
      on: vi.fn(),
    },
    execute: vi.fn(),
    getConnection: vi.fn(),
    end: vi.fn(),
  };

  return {
    conexion,
    pool,
    createPool: vi.fn(() => pool),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
    env: {
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_USER: 'usuario',
      DB_PASSWORD: 'clave',
      DB_NAME: 'hbsa_test',
      DB_POOL_LIMIT: 10,
    },
  };
});

vi.mock('mysql2/promise', () => ({
  createPool: mocks.createPool,
}));

vi.mock('../../../src/config/env', () => ({
  env: mocks.env,
}));

vi.mock('../../../src/config/logger', () => ({
  logger: mocks.logger,
}));

describe('acceso a base de datos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.createPool.mockReturnValue(mocks.pool);
    mocks.pool.execute.mockResolvedValue([[], []]);
    mocks.pool.getConnection.mockResolvedValue(mocks.conexion);
    mocks.pool.end.mockResolvedValue(undefined);

    mocks.conexion.beginTransaction.mockResolvedValue(undefined);
    mocks.conexion.commit.mockResolvedValue(undefined);
    mocks.conexion.rollback.mockResolvedValue(undefined);
    mocks.conexion.release.mockReturnValue(undefined);
    mocks.conexion.execute.mockResolvedValue([[], []]);
  });

  it('crea el pool con la configuracion institucional y tecnica', async () => {
    const { obtenerBaseDatos } = await import('../../../src/config/database');

    obtenerBaseDatos();

    expect(mocks.createPool).toHaveBeenCalledWith({
      host: 'localhost',
      port: 3306,
      user: 'usuario',
      password: 'clave',
      database: 'hbsa_test',
      connectionLimit: 10,
      waitForConnections: true,
      timezone: 'Z',
      dateStrings: ['DATE'],
    });

    expect(mocks.logger.info).toHaveBeenCalledWith('Pool de MySQL creado', {
      host: 'localhost',
      base: 'hbsa_test',
    });
  });

  it('configura UTC cuando se crea una conexion fisica', async () => {
    const query = vi.fn().mockResolvedValue([[], []]);
    const promesa = vi.fn(() => ({ query }));

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    obtenerBaseDatos();

    expect(mocks.pool.pool.on).toHaveBeenCalledWith(
      'connection',
      expect.any(Function),
    );

    const inicializar = mocks.pool.pool.on.mock.calls[0]?.[1] as (
      conexion: { promise: typeof promesa },
    ) => void;

    inicializar({ promise: promesa });

    expect(promesa).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("SET time_zone = '+00:00'");
  });

  it('registra el error cuando no puede configurar UTC en una conexion', async () => {
    const error = new Error('fallo al establecer UTC');
    const query = vi.fn().mockRejectedValue(error);
    const promesa = vi.fn(() => ({ query }));

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    obtenerBaseDatos();

    const inicializar = mocks.pool.pool.on.mock.calls[0]?.[1] as (
      conexion: { promise: typeof promesa },
    ) => void;

    inicializar({ promise: promesa });

    await vi.waitFor(() =>
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'No se pudo establecer UTC en una conexion MySQL',
        { error },
      ),
    );
  });

  it('registra errores no convencionales al configurar UTC', async () => {
    const query = vi.fn().mockRejectedValue('error de conexion');
    const promesa = vi.fn(() => ({ query }));

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    obtenerBaseDatos();

    const inicializar = mocks.pool.pool.on.mock.calls[0]?.[1] as (
      conexion: { promise: typeof promesa },
    ) => void;

    inicializar({ promise: promesa });

    await vi.waitFor(() =>
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'No se pudo establecer UTC en una conexion MySQL',
        { error: new Error('error de conexion') },
      ),
    );
  });
  it('reutiliza la misma instancia de base de datos', async () => {
    const { obtenerBaseDatos } = await import('../../../src/config/database');

    expect(obtenerBaseDatos()).toBe(obtenerBaseDatos());
    expect(mocks.createPool).toHaveBeenCalledOnce();
  });

  it('consulta filas mediante parametros y devuelve el resultado', async () => {
    const filas = [{ id: 1, nombre: 'Area' }];
    mocks.pool.execute.mockResolvedValue([filas, []]);

    const { obtenerBaseDatos } = await import('../../../src/config/database');
    const resultado = await obtenerBaseDatos().consultar(
      'SELECT * FROM areas WHERE id = ?',
      [1],
    );

    expect(resultado).toBe(filas);
    expect(mocks.pool.execute).toHaveBeenCalledWith(
      'SELECT * FROM areas WHERE id = ?',
      [1],
    );
  });

  it('consulta sin parametros cuando no se proporcionan valores', async () => {
    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await obtenerBaseDatos().consultar('SELECT 1');

    expect(mocks.pool.execute).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('ejecuta sentencias y devuelve filas afectadas e identificador', async () => {
    mocks.pool.execute.mockResolvedValue([
      { affectedRows: 2, insertId: 15 },
      [],
    ]);

    const { obtenerBaseDatos } = await import('../../../src/config/database');
    const resultado = await obtenerBaseDatos().ejecutar(
      'INSERT INTO areas (nombre) VALUES (?)',
      ['Consulta'],
    );

    expect(resultado).toEqual({
      filasAfectadas: 2,
      idInsertado: 15,
    });
  });

  it('ejecuta sentencias sin parametros cuando no se proporcionan valores', async () => {
    mocks.pool.execute.mockResolvedValue([
      { affectedRows: 1, insertId: 0 },
      [],
    ]);

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await obtenerBaseDatos().ejecutar('UPDATE areas SET activo = 1');

    expect(mocks.pool.execute).toHaveBeenCalledWith(
      'UPDATE areas SET activo = 1',
      [],
    );
  });

  it('confirma la transaccion y devuelve el resultado del trabajo', async () => {
    mocks.conexion.execute.mockResolvedValue([
      { affectedRows: 1, insertId: 8 },
      [],
    ]);

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    const resultado = await obtenerBaseDatos().transaccion(async (conexion) => {
      return conexion.ejecutar('INSERT INTO areas (nombre) VALUES (?)', ['UCI']);
    });

    expect(resultado).toEqual({
      filasAfectadas: 1,
      idInsertado: 8,
    });
    expect(mocks.conexion.beginTransaction).toHaveBeenCalledOnce();
    expect(mocks.conexion.commit).toHaveBeenCalledOnce();
    expect(mocks.conexion.rollback).not.toHaveBeenCalled();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('permite consultar dentro de una transaccion', async () => {
    const filas = [{ id: 3 }];
    mocks.conexion.execute.mockResolvedValue([filas, []]);

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    const resultado = await obtenerBaseDatos().transaccion((conexion) =>
      conexion.consultar('SELECT * FROM areas WHERE id = ?', [3]),
    );

    expect(resultado).toBe(filas);
    expect(mocks.conexion.execute).toHaveBeenCalledWith(
      'SELECT * FROM areas WHERE id = ?',
      [3],
    );
    expect(mocks.conexion.commit).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('revierte la transaccion cuando el trabajo falla y propaga el error', async () => {
    const error = new Error('fallo del trabajo');

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.commit).not.toHaveBeenCalled();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('libera la conexion si falla el inicio de la transaccion', async () => {
    mocks.conexion.beginTransaction.mockRejectedValue(
      new Error('no se pudo iniciar'),
    );

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => Promise.resolve('resultado')),
    ).rejects.toThrow('no se pudo iniciar');

    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('verifica la disponibilidad mediante una consulta SELECT 1', async () => {
    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(obtenerBaseDatos().verificar()).resolves.toBeUndefined();

    expect(mocks.pool.execute).toHaveBeenCalledWith('SELECT 1 AS ok', []);
  });

  it('propaga los errores de la verificacion', async () => {
    mocks.pool.execute.mockRejectedValue(new Error('mysql no disponible'));

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(obtenerBaseDatos().verificar()).rejects.toThrow(
      'mysql no disponible',
    );
  });

  it('cierra el pool y permite crear una nueva instancia', async () => {
    const segundoPool = {
      ...mocks.pool,
      execute: vi.fn().mockResolvedValue([[], []]),
      getConnection: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    };

    mocks.createPool
      .mockReturnValueOnce(mocks.pool)
      .mockReturnValueOnce(segundoPool);

    const { obtenerBaseDatos, cerrarBaseDatos } = await import(
      '../../../src/config/database'
    );

    const primera = obtenerBaseDatos();

    await cerrarBaseDatos();

    expect(mocks.pool.end).toHaveBeenCalledOnce();

    const segunda = obtenerBaseDatos();

    expect(segunda).not.toBe(primera);
    expect(mocks.createPool).toHaveBeenCalledTimes(2);
  });

  it('no intenta cerrar un pool que no fue inicializado', async () => {
    const { cerrarBaseDatos } = await import('../../../src/config/database');

    await expect(cerrarBaseDatos()).resolves.toBeUndefined();

    expect(mocks.createPool).not.toHaveBeenCalled();
  });

  it('conserva la instancia si falla el cierre del pool', async () => {
    mocks.pool.end.mockRejectedValue(new Error('no se pudo cerrar'));

    const { obtenerBaseDatos, cerrarBaseDatos } = await import(
      '../../../src/config/database'
    );

    const primera = obtenerBaseDatos();

    await expect(cerrarBaseDatos()).rejects.toThrow('no se pudo cerrar');

    expect(obtenerBaseDatos()).toBe(primera);
    expect(mocks.createPool).toHaveBeenCalledOnce();
  });

  it('libera la conexion cuando falla el trabajo y el rollback', async () => {
    mocks.conexion.rollback.mockRejectedValue(
      new Error('no se pudo revertir'),
    );

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => {
        throw new Error('fallo del trabajo');
      }),
    ).rejects.toThrow('no se pudo revertir');

    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });
  it('propaga el error de rollback cuando falla la reversión', async () => {
    mocks.conexion.rollback.mockRejectedValue(
      new Error('fallo al revertir'),
    );

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => {
        throw new Error('fallo del trabajo');
      }),
    ).rejects.toThrow('fallo al revertir');

    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('libera la conexion cuando fallan el inicio y la reversión', async () => {
    mocks.conexion.beginTransaction.mockRejectedValue(
      new Error('no se pudo iniciar'),
    );
    mocks.conexion.rollback.mockRejectedValue(
      new Error('no se pudo revertir'),
    );

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => Promise.resolve('resultado')),
    ).rejects.toThrow('no se pudo revertir');

    expect(mocks.conexion.beginTransaction).toHaveBeenCalledOnce();
    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });

  it('revierte y libera la conexion cuando falla el commit', async () => {
    const error = new Error('no se pudo confirmar');

    mocks.conexion.commit.mockRejectedValue(error);

    const { obtenerBaseDatos } = await import('../../../src/config/database');

    await expect(
      obtenerBaseDatos().transaccion(() => Promise.resolve('resultado')),
    ).rejects.toBe(error);

    expect(mocks.conexion.commit).toHaveBeenCalledOnce();
    expect(mocks.conexion.rollback).toHaveBeenCalledOnce();
    expect(mocks.conexion.release).toHaveBeenCalledOnce();
  });
});