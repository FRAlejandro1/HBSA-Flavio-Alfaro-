import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos } from '../../../../src/config/database';
import { PeriodosRepository } from '../../../../src/modules/vacaciones/vacaciones.periodos.repository';
import type { PeriodoNuevo } from '../../../../src/modules/vacaciones/vacaciones.periodos';

describe('PeriodosRepository', () => {
  const consultar = vi.fn();
  const ejecutar = vi.fn();

  const bd = {
    consultar,
    ejecutar,
  } as unknown as IBaseDatos;

  let repositorio: PeriodosRepository;

  const periodos: PeriodoNuevo[] = [
    {
      fechaInicio: '2025-01-01',
      fechaCaducidad: '2026-01-01',
    },
    {
      fechaInicio: '2026-01-01',
      fechaCaducidad: '2027-01-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    consultar.mockResolvedValue([]);
    ejecutar.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });
    repositorio = new PeriodosRepository(bd);
  });

  describe('buscarDatosDePeriodos', () => {
    it('consulta los datos de la persona dentro de su hospital', async () => {
      consultar.mockResolvedValue([{
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: '35',
        diasVacacionesArea: '25',
      }]);

      await expect(repositorio.buscarDatosDePeriodos(7, 20)).resolves.toEqual({
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: 35,
        diasVacacionesArea: 25,
      });

      expect(consultar).toHaveBeenCalledOnce();
      expect(consultar.mock.calls[0]?.[0]).toContain('u.empresa_id = ?');
      expect(consultar.mock.calls[0]?.[0]).toContain('a.empresa_id = u.empresa_id');
      expect(consultar.mock.calls[0]?.[1]).toEqual([7, 20]);
    });

    it('devuelve null cuando la persona no existe en el hospital', async () => {
      consultar.mockResolvedValue([]);

      await expect(repositorio.buscarDatosDePeriodos(7, 20)).resolves.toBeNull();
    });

    it('conserva los valores null de configuración individual y del área', async () => {
      consultar.mockResolvedValue([{
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: null,
        diasVacacionesArea: null,
      }]);

      await expect(repositorio.buscarDatosDePeriodos(7, 20)).resolves.toEqual({
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: null,
        diasVacacionesArea: null,
      });
    });

    it('convierte independientemente los valores numéricos configurados', async () => {
      consultar.mockResolvedValue([{
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: null,
        diasVacacionesArea: '30.5',
      }]);

      await expect(repositorio.buscarDatosDePeriodos(7, 20)).resolves.toEqual({
        fechaIngreso: '2020-05-10',
        diasVacacionesPersona: null,
        diasVacacionesArea: 30.5,
      });
    });
  });

  describe('filtrarPeriodosFaltantes', () => {
    it('devuelve un arreglo vacío sin consultar cuando no recibe periodos', async () => {
      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, []),
      ).resolves.toEqual([]);

      expect(consultar).not.toHaveBeenCalled();
    });

    it('devuelve únicamente los periodos que todavía no existen', async () => {
      consultar.mockResolvedValue([
        { fechaInicio: '2025-01-01' },
      ]);

      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, periodos),
      ).resolves.toEqual([periodos[1]]);

      expect(consultar).toHaveBeenCalledOnce();
      expect(consultar.mock.calls[0]?.[0]).toContain('fecha_inicio IN (?, ?)');
      expect(consultar.mock.calls[0]?.[1]).toEqual([
        7, 20, '2025-01-01', '2026-01-01',
      ]);
    });

    it('devuelve todos los periodos cuando ninguno existe', async () => {
      consultar.mockResolvedValue([]);

      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, periodos),
      ).resolves.toEqual(periodos);
    });

    it('devuelve un arreglo vacío cuando todos los periodos ya existen', async () => {
      consultar.mockResolvedValue([
        { fechaInicio: '2025-01-01' },
        { fechaInicio: '2026-01-01' },
      ]);

      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, periodos),
      ).resolves.toEqual([]);
    });

    it('traduce el error cuando la persona no existe en el hospital', async () => {
      consultar.mockRejectedValue({
        code: 'ER_NO_REFERENCED_ROW_2',
      });

      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, periodos),
      ).rejects.toThrow('La persona indicada no existe en este hospital');
    });

    it('propaga el error original cuando no existe una traducción específica', async () => {
      const error = new Error('Error de consulta');
      consultar.mockRejectedValue(error);

      await expect(
        repositorio.filtrarPeriodosFaltantes(7, 20, periodos),
      ).rejects.toBe(error);
    });
  });

  describe('crearPeriodosFaltantes', () => {
    it('inserta cada periodo con los días de derecho configurados', async () => {
      await expect(
        repositorio.crearPeriodosFaltantes(7, 20, periodos, 30),
      ).resolves.toBeUndefined();

      expect(ejecutar).toHaveBeenCalledTimes(2);
      expect(ejecutar.mock.calls[0]?.[0]).toContain('ON DUPLICATE KEY UPDATE dias_derecho = dias_derecho');
      expect(ejecutar.mock.calls[0]?.[1]).toEqual([
        7, 20, '2025-01-01', '2026-01-01', 30,
      ]);
      expect(ejecutar.mock.calls[1]?.[1]).toEqual([
        7, 20, '2026-01-01', '2027-01-01', 30,
      ]);
    });

    it('no ejecuta consultas cuando no recibe periodos', async () => {
      await expect(
        repositorio.crearPeriodosFaltantes(7, 20, [], 30),
      ).resolves.toBeUndefined();

      expect(ejecutar).not.toHaveBeenCalled();
    });

    it('traduce el error cuando la persona no existe en el hospital', async () => {
      ejecutar.mockRejectedValue({
        code: 'ER_NO_REFERENCED_ROW_2',
      });

      await expect(
        repositorio.crearPeriodosFaltantes(7, 20, [periodos[0]!], 30),
      ).rejects.toThrow('La persona indicada no existe en este hospital');
    });

    it('detiene la creación y propaga el error original', async () => {
      const error = new Error('Error de inserción');
      ejecutar.mockRejectedValue(error);

      await expect(
        repositorio.crearPeriodosFaltantes(7, 20, [periodos[0]!], 30),
      ).rejects.toBe(error);
    });

    it('detiene el proceso cuando falla la inserción de un periodo posterior', async () => {
      ejecutar
        .mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 })
        .mockRejectedValueOnce(new Error('Error en el segundo periodo'));

      await expect(
        repositorio.crearPeriodosFaltantes(7, 20, periodos, 30),
      ).rejects.toThrow('Error en el segundo periodo');

      expect(ejecutar).toHaveBeenCalledTimes(2);
    });
  });
});