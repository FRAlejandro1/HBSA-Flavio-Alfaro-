// Pruebas unitarias del repositorio de delegaciones.
// Verifica aislamiento institucional, concurrencia, transacciones y auditoría.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos, IConexionBD } from '../../../../src/config/database';
import { DelegacionesRepository } from '../../../../src/modules/delegaciones/delegaciones.repository';

const FECHA_DESDE = new Date('2027-01-01T08:00:00.000Z');
const FECHA_HASTA = new Date('2027-01-10T08:00:00.000Z');
const FECHA_REVOCACION = new Date('2026-12-01T10:00:00.000Z');

const FILA_DELEGACION = {
  id: 7,
  deleganteId: 10,
  deleganteNombres: 'Ana',
  deleganteApellidos: 'Lopez',
  delegadoId: 20,
  delegadoNombres: 'Luis',
  delegadoApellidos: 'Perez',
  creadaPorId: 1,
  vigenteDesde: FECHA_DESDE,
  vigenteHasta: FECHA_HASTA,
  motivo: 'Ausencia temporal',
  revocadaAt: null,
  creadaAt: new Date('2026-11-01T10:00:00.000Z'),
  estado: 'PROGRAMADA' as const,
};

const DELEGACION_ESPERADA = {
  id: 7,
  delegante: { id: 10, nombres: 'Ana', apellidos: 'Lopez' },
  delegado: { id: 20, nombres: 'Luis', apellidos: 'Perez' },
  creadaPorId: 1,
  vigenteDesde: FECHA_DESDE,
  vigenteHasta: FECHA_HASTA,
  motivo: 'Ausencia temporal',
  revocadaAt: null,
  estado: 'PROGRAMADA',
  creadaAt: FILA_DELEGACION.creadaAt,
};

const DATOS_CREACION = {
  deleganteId: 10,
  delegadoId: 20,
  vigenteDesde: FECHA_DESDE,
  vigenteHasta: FECHA_HASTA,
  motivo: 'Ausencia temporal',
};

describe('DelegacionesRepository', () => {
  const conexion = {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
  } satisfies IConexionBD;

  const transaccionMock = vi.fn();

  const ejecutarTransaccion: IBaseDatos['transaccion'] = <T>(
    trabajo: (conexion: IConexionBD) => Promise<T>,
  ): Promise<T> => {
    transaccionMock();
    return trabajo(conexion);
  };

  const bd = {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
    transaccion: ejecutarTransaccion,
    verificar: vi.fn(),
    cerrar: vi.fn(),
  } satisfies IBaseDatos;

  let repositorio: DelegacionesRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    conexion.consultar.mockResolvedValue([]);
    bd.consultar.mockResolvedValue([FILA_DELEGACION]);



    conexion.ejecutar.mockResolvedValue({
      filasAfectadas: 1,
      idInsertado: 7,
    });

    repositorio = new DelegacionesRepository(bd);
  });

  describe('listar', () => {
    it('lista delegaciones y mapea las personas relacionadas', async () => {
      bd.consultar
        .mockResolvedValueOnce([FILA_DELEGACION])
        .mockResolvedValueOnce([{ total: '1' }]);

      const resultado = await repositorio.listar(1, {
        pagina: 1,
        porPagina: 10,
      });

      expect(bd.consultar).toHaveBeenCalledTimes(2);
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('INNER JOIN usuarios delegante');
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('INNER JOIN usuarios delegado');
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('d.empresa_id = ?');
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('LIMIT 10 OFFSET 0');
      expect(bd.consultar.mock.calls[0]?.[1]).toEqual([1]);
      expect(bd.consultar.mock.calls[1]?.[1]).toEqual([1]);
      expect(resultado).toEqual({
        delegaciones: [DELEGACION_ESPERADA],
        total: 1,
      });
    });

    it('aplica filtros de delegante, delegado y estado', async () => {
      bd.consultar
        .mockResolvedValueOnce([FILA_DELEGACION])
        .mockResolvedValueOnce([{ total: 2 }]);

      await repositorio.listar(3, {
        deleganteId: 10,
        delegadoId: 20,
        estado: 'VIGENTE',
        pagina: 2,
        porPagina: 5,
      });

      const [sql, valores] = bd.consultar.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain('d.delegante_id = ?');
      expect(sql).toContain('d.delegado_id = ?');
      expect(sql).toContain("END = ?");
      expect(sql).toContain('LIMIT 5 OFFSET 5');
      expect(valores).toEqual([3, 10, 20, 'VIGENTE']);
      expect(bd.consultar.mock.calls[1]?.[1]).toEqual([3, 10, 20, 'VIGENTE']);
    });

    it('devuelve una lista vacía y total cero cuando no hay registros', async () => {
      bd.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const resultado = await repositorio.listar(4, {
        pagina: 1,
        porPagina: 20,
      });

      expect(resultado).toEqual({ delegaciones: [], total: 0 });
    });

    it('convierte el total nulo a cero', async () => {
      bd.consultar.mockResolvedValueOnce([FILA_DELEGACION]).mockResolvedValueOnce([]);

      const resultado = await repositorio.listar(1, {
        pagina: 1,
        porPagina: 10,
      });

      expect(resultado.total).toBe(0);
    });

    it('trunca los valores de paginación', async () => {
      bd.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

      await repositorio.listar(1, {
        pagina: 2.9,
        porPagina: 4.8,
      });

      expect(bd.consultar.mock.calls[0]?.[0]).toContain('LIMIT 4 OFFSET 4');
    });

    it('mantiene el aislamiento por hospital en ambas consultas', async () => {
      bd.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

      await repositorio.listar(9, {
        pagina: 1,
        porPagina: 10,
      });

      expect(bd.consultar.mock.calls[0]?.[1]).toEqual([9]);
      expect(bd.consultar.mock.calls[1]?.[1]).toEqual([9]);
    });
  });

  describe('obtener', () => {
    it('recupera una delegación y transforma sus datos', async () => {
      bd.consultar.mockResolvedValueOnce([FILA_DELEGACION]);

      const resultado = await repositorio.obtener(1, 7);

      expect(bd.consultar).toHaveBeenCalledWith(
        expect.stringContaining('WHERE d.empresa_id = ? AND d.id = ?'),
        [1, 7],
      );
      expect(resultado).toEqual(DELEGACION_ESPERADA);
    });

    it('devuelve null cuando la delegación no existe', async () => {
      bd.consultar.mockResolvedValueOnce([]);

      await expect(repositorio.obtener(1, 99)).resolves.toBeNull();
    });

    it('no recupera delegaciones de otro hospital', async () => {
      bd.consultar.mockResolvedValueOnce([]);

      await repositorio.obtener(2, 7);

      expect(bd.consultar).toHaveBeenCalledWith(expect.any(String), [2, 7]);
    });
  });

  describe('crear', () => {
    it('bloquea usuarios en orden estable, registra delegación y auditoría', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      const resultado = await repositorio.crear(1, 30, DATOS_CREACION);

      expect(transaccionMock).toHaveBeenCalledOnce();
      expect(conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        [1, 10],
      );
      expect(conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FOR UPDATE'),
        [1, 20],
      );
      expect(conexion.consultar).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('vigente_desde < ?'),
        [1, 10, FECHA_HASTA, FECHA_DESDE],
      );
      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO delegaciones'),
        [1, 10, 20, FECHA_DESDE, FECHA_HASTA, 30, 'Ausencia temporal'],
      );
      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          1,
          30,
          7,
          JSON.stringify({
            deleganteId: 10,
            delegadoId: 20,
            vigenteDesde: FECHA_DESDE,
            vigenteHasta: FECHA_HASTA,
            motivo: 'Ausencia temporal',
          }),
        ],
      );
      expect(resultado).toEqual(DELEGACION_ESPERADA);
    });

    it('bloquea identificadores únicos en orden ascendente', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      await repositorio.crear(1, 30, {
        ...DATOS_CREACION,
        deleganteId: 20,
        delegadoId: 10,
      });

      expect(conexion.consultar.mock.calls[0]?.[1]).toEqual([1, 10]);
      expect(conexion.consultar.mock.calls[1]?.[1]).toEqual([1, 20]);
    });

    it('rechaza usuarios inexistentes o inactivos y no inserta registros', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([]);

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'El delegante y el delegado deben existir y estar activos en este hospital',
      });

      expect(conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza la auto delegación', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 10 }]);

      await expect(
        repositorio.crear(1, 30, {
          ...DATOS_CREACION,
          delegadoId: 10,
        }),
      ).rejects.toMatchObject({
        message: 'Una persona no puede delegar sus atribuciones en si misma',
      });

      expect(conexion.consultar).toHaveBeenCalledOnce();
      expect(conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza periodos superpuestos', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([{ id: 99 }]);

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'El responsable ya tiene una delegacion registrada para ese periodo',
      });

      expect(conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('permite registrar cuando el periodo anterior está revocado', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      await repositorio.crear(1, 30, DATOS_CREACION);

      expect(conexion.consultar.mock.calls[2]?.[0]).toContain('revocada_at IS NULL');
      expect(conexion.ejecutar).toHaveBeenCalledTimes(2);
    });

    it('recupera la delegación registrada después de confirmar la transacción', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      await repositorio.crear(5, 30, DATOS_CREACION);

      expect(bd.consultar).toHaveBeenCalledWith(
        expect.stringContaining('WHERE d.empresa_id = ? AND d.id = ?'),
        [5, 7],
      );
    });

    it('lanza error si no puede recuperar la delegación creada', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([]);
      bd.consultar.mockResolvedValueOnce([]);

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'No se pudo recuperar la delegacion registrada',
      });
    });

    it('traduce errores de clave duplicada', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([]);
      conexion.ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'Ya existe una delegacion incompatible para este responsable',
      });
    });

    it('traduce errores de referencia inválida', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([]);
      conexion.ejecutar.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'El delegante o el delegado no existe o no pertenece a este hospital',
      });
    });

    it('conserva errores no reconocidos', async () => {
      const error = new Error('Fallo de conexión');
      conexion.consultar.mockRejectedValueOnce(error);

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toBe(error);
    });

    it('convierte valores no Error en un Error', async () => {
      conexion.consultar.mockRejectedValueOnce('fallo inesperado');

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'fallo inesperado',
      });
    });

    it('lanza error si no encuentra usuarios al bloquearlos', async () => {
      conexion.consultar.mockResolvedValueOnce([]);

      await expect(
        repositorio.crear(1, 30, DATOS_CREACION),
      ).rejects.toMatchObject({
        message: 'El delegante y el delegado deben existir y estar activos en este hospital',
      });
    });

    it('no duplica el bloqueo cuando ambos identificadores son iguales', async () => {
      conexion.consultar.mockResolvedValueOnce([{ id: 10 }]);

      await expect(
        repositorio.crear(1, 30, {
          ...DATOS_CREACION,
          delegadoId: 10,
        }),
      ).rejects.toMatchObject({
        message: 'Una persona no puede delegar sus atribuciones en si misma',
      });

      expect(conexion.consultar).toHaveBeenCalledOnce();
    });
  });

  describe('revocar', () => {
    it('bloquea la delegación, la revoca y registra auditoría', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 7, revocadaAt: null }])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      const resultado = await repositorio.revocar(1, 7, 30, FECHA_REVOCACION);

      expect(transaccionMock).toHaveBeenCalledOnce();
      expect(conexion.consultar).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [1, 7],
      );
      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE delegaciones'),
        [FECHA_REVOCACION, 1, 7],
      );
      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          1,
          30,
          7,
          JSON.stringify({ revocadaAt: FECHA_REVOCACION }),
        ],
      );
      expect(resultado).toEqual(DELEGACION_ESPERADA);
    });

    it('rechaza la revocación si la delegación no existe en el hospital', async () => {
      conexion.consultar.mockResolvedValueOnce([]);

      await expect(
        repositorio.revocar(2, 7, 30, FECHA_REVOCACION),
      ).rejects.toMatchObject({
        message: 'La delegacion no existe en este hospital',
      });

      expect(conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza una delegación previamente revocada', async () => {
      conexion.consultar.mockResolvedValueOnce([
        { id: 7, revocadaAt: FECHA_REVOCACION },
      ]);

      await expect(
        repositorio.revocar(1, 7, 30, FECHA_REVOCACION),
      ).rejects.toMatchObject({
        message: 'La delegacion ya fue revocada',
      });

      expect(conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('lanza error si no puede recuperar la delegación revocada', async () => {
      conexion.consultar.mockResolvedValueOnce([
        { id: 7, revocadaAt: null },
      ]);
      bd.consultar.mockResolvedValueOnce([]);

      await expect(
        repositorio.revocar(1, 7, 30, FECHA_REVOCACION),
      ).rejects.toMatchObject({
        message: 'No se pudo recuperar la delegacion revocada',
      });
    });

    it('traduce errores de referencias en uso', async () => {
      conexion.consultar.mockResolvedValueOnce([
        { id: 7, revocadaAt: null },
      ]);
      conexion.ejecutar.mockRejectedValueOnce({
        code: 'ER_ROW_IS_REFERENCED_2',
      });

      await expect(
        repositorio.revocar(1, 7, 30, FECHA_REVOCACION),
      ).rejects.toMatchObject({
        message: 'El registro esta en uso y no se puede eliminar',
      });
    });

    it('mantiene el error original si falla la actualización por una causa desconocida', async () => {
      const error = new Error('Error interno');
      conexion.consultar.mockResolvedValueOnce([
        { id: 7, revocadaAt: null },
      ]);
      conexion.ejecutar.mockRejectedValueOnce(error);

      await expect(
        repositorio.revocar(1, 7, 30, FECHA_REVOCACION),
      ).rejects.toBe(error);
    });

    it('utiliza el hospital indicado en todas las operaciones de revocación', async () => {
      conexion.consultar
        .mockResolvedValueOnce([{ id: 7, revocadaAt: null }])
        .mockResolvedValueOnce([FILA_DELEGACION]);

      await repositorio.revocar(8, 7, 40, FECHA_REVOCACION);

      expect(conexion.consultar.mock.calls[0]?.[1]).toEqual([8, 7]);
      expect(conexion.ejecutar.mock.calls[0]?.[1]).toEqual([
        FECHA_REVOCACION,
        8,
        7,
      ]);
      expect(conexion.ejecutar.mock.calls[1]?.[1]).toEqual([
        8,
        40,
        7,
        JSON.stringify({ revocadaAt: FECHA_REVOCACION }),
      ]);
      expect(bd.consultar).toHaveBeenCalledWith(expect.any(String), [8, 7]);
    });
  });
});

