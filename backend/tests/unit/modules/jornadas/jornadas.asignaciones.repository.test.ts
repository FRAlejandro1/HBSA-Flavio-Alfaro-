// Pruebas del repositorio de asignaciones de jornadas.
// Verifica aislamiento por empresa, prevención de solapamientos,
// cierre histórico y consulta de asignaciones por fecha.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IBaseDatos,
  IConexionBD,
  ResultadoEjecucion,
  ValorSql,
} from '../../../../src/config/database';
import { JornadasRepository } from '../../../../src/modules/jornadas/jornadas.repository';

interface FilaAsignacionPrueba {
  id: number;
  usuario_id: number;
  patron_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_referencia: string;
  configurado_por_id: number;
}

/** Simula una conexión transaccional con respuestas SQL ordenadas. */
class ConexionPrueba implements IConexionBD {
  filas: object[][] = [];

  consultar = vi.fn(<T extends object>(
    _sql: string,
    _valores?: readonly ValorSql[],
  ): Promise<T[]> => Promise.resolve((this.filas.shift() ?? []) as unknown as T[])) as unknown as
    IConexionBD['consultar'] & ReturnType<typeof vi.fn>;

  ejecutar = vi.fn((): Promise<ResultadoEjecucion> => Promise.resolve({
    filasAfectadas: 1,
    idInsertado: 31,
  }));
}

/** Construye el entorno aislado para las pruebas del repositorio. */
function crearEntorno() {
  const conexion = new ConexionPrueba();

  const transaccion = vi.fn(<T>(
    trabajo: (conexion: IConexionBD) => Promise<T>,
  ): Promise<T> => trabajo(conexion));

  const bd = {
    consultar: conexion.consultar,
    ejecutar: conexion.ejecutar,
    transaccion,
    verificar: vi.fn(() => Promise.resolve()),
    cerrar: vi.fn(() => Promise.resolve()),
  } as unknown as IBaseDatos;

  return {
    conexion,
    repositorio: new JornadasRepository(bd),
    bd,
    transaccion,
  };
}

const ASIGNACION: FilaAsignacionPrueba = {
  id: 31,
  usuario_id: 12,
  patron_id: 7,
  fecha_inicio: '2026-01-01',
  fecha_fin: null,
  fecha_referencia: '2026-01-01',
  configurado_por_id: 3,
};

describe('JornadasRepository - asignaciones', () => {
  let entorno: ReturnType<typeof crearEntorno>;

  beforeEach(() => {
    entorno = crearEntorno();
  });

  describe('crearAsignacion', () => {
    it('crea una asignación, registra auditoría y devuelve el modelo de dominio', async () => {
      entorno.conexion.filas = [
        [{ id: 12 }],
        [{ id: 7, activo: 1 }],
        [],
        [ASIGNACION],
      ];

      const resultado = await entorno.repositorio.crearAsignacion(5, 3, {
        usuarioId: 12,
        patronId: 7,
        fechaInicio: '2026-01-01',
        fechaReferencia: '2026-01-01',
      });

      expect(resultado).toEqual({
        id: 31,
        usuarioId: 12,
        patronId: 7,
        fechaInicio: '2026-01-01',
        fechaFin: null,
        fechaReferencia: '2026-01-01',
        configuradoPorId: 3,
      });

      expect(entorno.transaccion).toHaveBeenCalledOnce();
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM usuarios'),
        [5, 12],
      );
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM patrones_jornada'),
        [5, 7],
      );
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM asignaciones_jornada'),
        [5, 12, '2026-01-01'],
      );
      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);
      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('JORNADA_ASIGNADA'),
        expect.arrayContaining([5, 3, 31]),
      );
    });

    it('rechaza una asignación si el empleado no pertenece a la empresa', async () => {
      entorno.conexion.filas = [[]];

      await expect(
        entorno.repositorio.crearAsignacion(5, 3, {
          usuarioId: 12,
          patronId: 7,
          fechaInicio: '2026-01-01',
          fechaReferencia: '2026-01-01',
        }),
      ).rejects.toThrow('El empleado no existe en este hospital');

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza la asignación de un patrón inactivo', async () => {
      entorno.conexion.filas = [
        [{ id: 12 }],
        [{ id: 7, activo: 0 }],
      ];

      await expect(
        entorno.repositorio.crearAsignacion(5, 3, {
          usuarioId: 12,
          patronId: 7,
          fechaInicio: '2026-01-01',
          fechaReferencia: '2026-01-01',
        }),
      ).rejects.toThrow('No se puede asignar un patrón inactivo');

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza una asignación que se solapa con otra del empleado', async () => {
      entorno.conexion.filas = [
        [{ id: 12 }],
        [{ id: 7, activo: 1 }],
        [{ id: 20 }],
      ];

      await expect(
        entorno.repositorio.crearAsignacion(5, 3, {
          usuarioId: 12,
          patronId: 7,
          fechaInicio: '2026-01-01',
          fechaReferencia: '2026-01-01',
        }),
      ).rejects.toThrow(
        'El empleado ya tiene una asignación de jornada que se solapa con la fecha indicada',
      );

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('filtra las consultas por empresa y empleado', async () => {
      entorno.conexion.filas = [
        [{ id: 12 }],
        [{ id: 7, activo: 1 }],
        [],
        [ASIGNACION],
      ];

      await entorno.repositorio.crearAsignacion(5, 3, {
        usuarioId: 12,
        patronId: 7,
        fechaInicio: '2026-01-01',
        fechaReferencia: '2026-01-01',
      });

      for (const llamada of entorno.conexion.consultar.mock.calls) {
        expect(llamada[0]).toContain('empresa_id = ?');
      }
    });
  });

  describe('cerrarAsignacion', () => {
    it('cierra la asignación sin eliminar el registro y registra auditoría', async () => {
      const cerrada: FilaAsignacionPrueba = {
        ...ASIGNACION,
        fecha_fin: '2026-06-30',
      };

      entorno.conexion.filas = [
        [ASIGNACION],
        [],
        [cerrada],
      ];

      const resultado = await entorno.repositorio.cerrarAsignacion(5, 3, {
        asignacionId: 31,
        fechaFin: '2026-06-30',
      });

      expect(resultado.fechaFin).toBe('2026-06-30');

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE asignaciones_jornada'),
        ['2026-06-30', 5, 31],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('JORNADA_ASIGNACION_CERRADA'),
        expect.arrayContaining([5, 3, 31]),
      );

      expect(entorno.transaccion).toHaveBeenCalledOnce();
    });

    it('rechaza cerrar una asignación inexistente en la empresa', async () => {
      entorno.conexion.filas = [[]];

      await expect(
        entorno.repositorio.cerrarAsignacion(5, 3, {
          asignacionId: 31,
          fechaFin: '2026-06-30',
        }),
      ).rejects.toThrow('La asignación no existe en este hospital');

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza cerrar una asignación que ya tiene fecha de fin', async () => {
      entorno.conexion.filas = [[
        { ...ASIGNACION, fecha_fin: '2026-05-31' },
      ]];

      await expect(
        entorno.repositorio.cerrarAsignacion(5, 3, {
          asignacionId: 31,
          fechaFin: '2026-06-30',
        }),
      ).rejects.toThrow('La asignación ya está cerrada');

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza una fecha de cierre anterior al inicio', async () => {
      entorno.conexion.filas = [[ASIGNACION]];

      await expect(
        entorno.repositorio.cerrarAsignacion(5, 3, {
          asignacionId: 31,
          fechaFin: '2025-12-31',
        }),
      ).rejects.toThrow(
        'La fecha de cierre no puede ser anterior al inicio de la asignación',
      );

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza un cierre que se solapa con otra asignación', async () => {
      entorno.conexion.filas = [
        [ASIGNACION],
        [{ id: 40 }],
      ];

      await expect(
        entorno.repositorio.cerrarAsignacion(5, 3, {
          asignacionId: 31,
          fechaFin: '2026-06-30',
        }),
      ).rejects.toThrow(
        'La fecha de cierre se solapa con otra asignación del empleado',
      );

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerAsignacionParaFecha', () => {
    it('devuelve la asignación vigente en la fecha consultada', async () => {
      entorno.conexion.filas = [[ASIGNACION]];

      const resultado = await entorno.repositorio.obtenerAsignacionParaFecha(
        5,
        12,
        '2026-03-15',
      );

      expect(resultado).toEqual({
        id: 31,
        usuarioId: 12,
        patronId: 7,
        fechaInicio: '2026-01-01',
        fechaFin: null,
        fechaReferencia: '2026-01-01',
        configuradoPorId: 3,
      });

      expect(entorno.conexion.consultar).toHaveBeenCalledWith(
        expect.stringContaining('fecha_inicio <= ?'),
        [5, 12, '2026-03-15', '2026-03-15'],
      );
    });

    it('devuelve null cuando no existe una asignación para esa fecha', async () => {
      entorno.conexion.filas = [[]];

      const resultado = await entorno.repositorio.obtenerAsignacionParaFecha(
        5,
        12,
        '2026-03-15',
      );

      expect(resultado).toBeNull();
    });

    it('filtra la consulta por empresa y empleado', async () => {
      entorno.conexion.filas = [[ASIGNACION]];

      await entorno.repositorio.obtenerAsignacionParaFecha(
        5,
        12,
        '2026-03-15',
      );

      expect(entorno.conexion.consultar).toHaveBeenCalledWith(
        expect.stringContaining('empresa_id = ?'),
        [5, 12, '2026-03-15', '2026-03-15'],
      );
    });
  });
});


