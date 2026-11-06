// Pruebas del repositorio de jornadas.
// Verifican persistencia, aislamiento multiempresa, transacciones y auditoría
// mediante dobles de los contratos de infraestructura de base de datos.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IBaseDatos,
  IConexionBD,
  ResultadoEjecucion,
  ValorSql,
} from '../../../../src/config/database';
import { JornadasRepository } from '../../../../src/modules/jornadas/jornadas.repository';

class ConexionPrueba implements IConexionBD {
  filas: object[][] = [];

  consultar = vi.fn(<T extends object>(
    _sql: string,
    _valores?: readonly ValorSql[],
  ): Promise<T[]> => Promise.resolve(
    (this.filas.shift() ?? []) as T[],
  )) as IConexionBD['consultar'];

  ejecutar = vi.fn((
    _sql: string,
    _valores?: readonly ValorSql[],
  ): Promise<ResultadoEjecucion> => Promise.resolve({
    filasAfectadas: 1,
    idInsertado: 25,
  }));
}

function crearEntorno() {
  const conexion = new ConexionPrueba();

  const consultar = vi.fn(<T extends object>(
    _sql: string,
    _valores?: readonly ValorSql[],
  ): Promise<T[]> => Promise.resolve([]));

  const ejecutar = vi.fn(
    (): Promise<ResultadoEjecucion> => Promise.resolve({
      filasAfectadas: 1,
      idInsertado: 25,
    }),
  );

  const transaccion = vi.fn(
    <T>(trabajo: (conexion: IConexionBD) => Promise<T>): Promise<T> =>
      trabajo(conexion),
  );

  const bd = {
    consultar,
    ejecutar,
    transaccion,
    verificar: vi.fn(() => Promise.resolve()),
    cerrar: vi.fn(() => Promise.resolve()),
  } as unknown as IBaseDatos;

  return {
    repositorio: new JornadasRepository(bd),
    conexion,
    consultar,
    ejecutar,
    transaccion,
  };
}
const TURNO = {
  id: 25,
  nombre: 'Turno diurno',
  hora_inicio: '07:00:00',
  hora_fin: '15:00:00',
  minutos_descanso: 30,
  activo: 1,
};

describe('JornadasRepository', () => {
  let entorno: ReturnType<typeof crearEntorno>;

  beforeEach(() => {
    entorno = crearEntorno();
  });

  describe('obtenerTurno', () => {
    it('devuelve el turno convertido al modelo de dominio', async () => {
      entorno.consultar.mockResolvedValueOnce([TURNO]);

      const resultado = await entorno.repositorio.obtenerTurno(3, 25);

      expect(resultado).toEqual({
        id: 25,
        nombre: 'Turno diurno',
        horaInicio: '07:00:00',
        horaFin: '15:00:00',
        minutosDescanso: 30,
        activo: true,
      });
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.stringContaining('WHERE empresa_id = ? AND id = ?'),
        [3, 25],
      );
    });

    it('devuelve null cuando el turno no existe en la empresa', async () => {
      entorno.consultar.mockResolvedValueOnce([]);

      const resultado = await entorno.repositorio.obtenerTurno(8, 25);

      expect(resultado).toBeNull();
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.stringContaining('empresa_id = ?'),
        [8, 25],
      );
    });

    it('propaga los errores no reconocidos de la base de datos', async () => {
      const error = new Error('Error de conexión');
      entorno.consultar.mockRejectedValueOnce(error);

      await expect(entorno.repositorio.obtenerTurno(3, 25)).rejects.toBe(error);
    });
  });

  describe('listarTurnos', () => {
    it('lista únicamente los turnos activos por defecto', async () => {
      entorno.consultar.mockResolvedValueOnce([TURNO]);

      const resultado = await entorno.repositorio.listarTurnos(3);

      expect(resultado).toHaveLength(1);
      expect(resultado[0]!.activo).toBe(true);
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.stringContaining('AND activo = 1'),
        [3],
      );
    });

    it('incluye los turnos inactivos cuando se solicita', async () => {
      entorno.consultar.mockResolvedValueOnce([
        { ...TURNO, activo: 0 },
      ]);

      const resultado = await entorno.repositorio.listarTurnos(3, true);

      expect(resultado[0]!.activo).toBe(false);
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.not.stringContaining('AND activo = 1'),
        [3],
      );
    });
  });

  describe('crearTurno', () => {
    it('crea el turno y registra la auditoría en una transacción', async () => {
      entorno.conexion.filas.push([TURNO]);

      const resultado = await entorno.repositorio.crearTurno(3, 9, {
        nombre: 'Turno diurno',
        horaInicio: '07:00:00',
        horaFin: '15:00:00',
        minutosDescanso: 30,
      });

      expect(resultado.id).toBe(25);
      expect(resultado.nombre).toBe('Turno diurno');
      expect(entorno.transaccion).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO turnos'),
        [3, 'Turno diurno', '07:00:00', '15:00:00', 30],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          3,
          9,
          25,
          JSON.stringify({
            despues: {
              nombre: 'Turno diurno',
              horaInicio: '07:00:00',
              horaFin: '15:00:00',
              minutosDescanso: 30,
            },
          }),
        ],
      );
    });

    it('traduce los errores de duplicidad de nombre', async () => {
      const errorDuplicado = Object.assign(new Error('Duplicado'), {
        code: 'ER_DUP_ENTRY',
      });

      entorno.conexion.ejecutar.mockRejectedValueOnce(errorDuplicado);

      await expect(
        entorno.repositorio.crearTurno(3, 9, {
          nombre: 'Turno diurno',
          horaInicio: '07:00:00',
          horaFin: '15:00:00',
          minutosDescanso: 30,
        }),
      ).rejects.toThrow('Ya existe un turno con ese nombre en este hospital');

      expect(entorno.transaccion).toHaveBeenCalledOnce();
    });

    it('falla si no puede recuperar el turno creado', async () => {
      await expect(
        entorno.repositorio.crearTurno(3, 9, {
          nombre: 'Turno diurno',
          horaInicio: '07:00:00',
          horaFin: '15:00:00',
          minutosDescanso: 30,
        }),
      ).rejects.toThrow('No se pudo recuperar el turno recién creado');
    });
  });

  describe('actualizarTurno', () => {
    it('bloquea el registro, actualiza sus datos y registra la auditoría', async () => {
      entorno.conexion.filas.push(
        [TURNO],
        [{ ...TURNO, nombre: 'Turno actualizado', activo: 0 }],
      );

      const datos = {
        nombre: 'Turno actualizado',
        horaInicio: '08:00:00',
        horaFin: '16:00:00',
        minutosDescanso: 45,
        activo: false,
      };

      const resultado = await entorno.repositorio.actualizarTurno(3, 9, 25, datos);

      expect(resultado.nombre).toBe('Turno actualizado');
      expect(resultado.activo).toBe(false);
      expect(entorno.transaccion).toHaveBeenCalledOnce();

      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        [3, 25],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE turnos'),
        ['Turno actualizado', '08:00:00', '16:00:00', 45, 0, 3, 25],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          3,
          9,
          25,
          JSON.stringify({
            antes: {
              id: 25,
              nombre: 'Turno diurno',
              horaInicio: '07:00:00',
              horaFin: '15:00:00',
              minutosDescanso: 30,
              activo: true,
            },
            despues: datos,
          }),
        ],
      );
    });

    it('no actualiza ni audita cuando el turno no existe en la empresa', async () => {
      entorno.conexion.filas.push([]);

      await expect(
        entorno.repositorio.actualizarTurno(8, 9, 25, {
          nombre: 'Turno actualizado',
          horaInicio: '08:00:00',
          horaFin: '16:00:00',
          minutosDescanso: 45,
          activo: true,
        }),
      ).rejects.toThrow('El turno no existe en este hospital');

      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('no acepta una actualización si no puede recuperar el registro actualizado', async () => {
      entorno.conexion.filas.push([TURNO], []);

      await expect(
        entorno.repositorio.actualizarTurno(3, 9, 25, {
          nombre: 'Turno actualizado',
          horaInicio: '08:00:00',
          horaFin: '16:00:00',
          minutosDescanso: 45,
          activo: true,
        }),
      ).rejects.toThrow('No se pudo recuperar el turno actualizado');
    });
  });

  describe('obtenerPatron', () => {
    it('obtiene el patrón y convierte sus días al modelo de dominio', async () => {
      entorno.consultar
        .mockResolvedValueOnce([{
          id: 25,
          nombre: 'Rotativo 2x1',
          descripcion: 'Dos días de trabajo y uno de descanso',
          ciclo_dias: '2',
          activo: 1,
        }])
        .mockResolvedValueOnce([
          { id: 1, dia_ciclo: '1', tipo_dia: 'TURNO', turno_id: 10 },
          { id: 2, dia_ciclo: '2', tipo_dia: 'DESCANSO', turno_id: null },
        ]);

      const resultado = await entorno.repositorio.obtenerPatron(3, 25);

      expect(resultado).toEqual({
        id: 25,
        nombre: 'Rotativo 2x1',
        descripcion: 'Dos días de trabajo y uno de descanso',
        cicloDias: 2,
        activo: true,
        dias: [
          { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 10 },
          { id: 2, diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
        ],
      });

      expect(entorno.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE empresa_id = ? AND id = ?'),
        [3, 25],
      );
      expect(entorno.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('WHERE empresa_id = ? AND patron_id = ?'),
        [3, 25],
      );
    });

    it('devuelve null cuando el patrón no pertenece a la empresa', async () => {
      entorno.consultar.mockResolvedValueOnce([]);

      const resultado = await entorno.repositorio.obtenerPatron(8, 25);

      expect(resultado).toBeNull();
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.stringContaining('empresa_id = ? AND id = ?'),
        [8, 25],
      );
      expect(entorno.consultar).toHaveBeenCalledOnce();
    });
  });

  describe('listarPatrones', () => {
    it('lista los patrones activos y recupera sus días', async () => {
      entorno.consultar
        .mockResolvedValueOnce([{
          id: 25,
          nombre: 'Rotativo 2x1',
          descripcion: null,
          ciclo_dias: 2,
          activo: 1,
        }])
        .mockResolvedValueOnce([
          { id: 1, dia_ciclo: 1, tipo_dia: 'TURNO', turno_id: 10 },
        ]);

      const resultado = await entorno.repositorio.listarPatrones(3);

      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toEqual({
        id: 25,
        nombre: 'Rotativo 2x1',
        descripcion: null,
        cicloDias: 2,
        activo: true,
        dias: [
          { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 10 },
        ],
      });
      expect(entorno.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('AND activo = 1'),
        [3],
      );
    });

    it('incluye los patrones inactivos cuando se solicita', async () => {
      entorno.consultar
        .mockResolvedValueOnce([{
          id: 25,
          nombre: 'Rotativo anterior',
          descripcion: null,
          ciclo_dias: 1,
          activo: 0,
        }])
        .mockResolvedValueOnce([]);

      const resultado = await entorno.repositorio.listarPatrones(3, true);

      expect(resultado[0]!.activo).toBe(false);
      expect(entorno.consultar).toHaveBeenNthCalledWith(
        1,
        expect.not.stringContaining('AND activo = 1'),
        [3],
      );
    });
  });

  describe('crearPatron', () => {
    it('crea el patrón, sus días y registra la auditoría en una transacción', async () => {
      entorno.conexion.filas.push(
        [{
          id: 25,
          nombre: 'Rotativo 2x1',
          descripcion: 'Dos días de trabajo y uno de descanso',
          ciclo_dias: 2,
          activo: 1,
        }],
        [
          { id: 1, dia_ciclo: 1, tipo_dia: 'TURNO', turno_id: 10 },
          { id: 2, dia_ciclo: 2, tipo_dia: 'DESCANSO', turno_id: null },
        ],
      );

      const datos = {
        nombre: 'Rotativo 2x1',
        descripcion: 'Dos días de trabajo y uno de descanso',
        cicloDias: 2,
        dias: [
          { diaCiclo: 1, tipoDia: 'TURNO' as const, turnoId: 10 },
          { diaCiclo: 2, tipoDia: 'DESCANSO' as const, turnoId: null },
        ],
      };

      const resultado = await entorno.repositorio.crearPatron(3, 9, datos);

      expect(resultado.id).toBe(25);
      expect(resultado.cicloDias).toBe(2);
      expect(resultado.dias).toHaveLength(2);
      expect(entorno.transaccion).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(4);

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO patrones_jornada'),
        [3, datos.nombre, datos.descripcion, datos.cicloDias],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO patrones_jornada_detalle'),
        [3, 25, 1, 'TURNO', 10],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO patrones_jornada_detalle'),
        [3, 25, 2, 'DESCANSO', null],
      );

      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          3,
          9,
          25,
          JSON.stringify({ despues: datos }),
        ],
      );

      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE empresa_id = ? AND id = ?'),
        [3, 25],
      );
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('WHERE empresa_id = ? AND patron_id = ?'),
        [3, 25],
      );
    });

    it('traduce los errores de duplicidad del nombre del patrón', async () => {
      const errorDuplicado = Object.assign(new Error('Duplicado'), {
        code: 'ER_DUP_ENTRY',
      });

      entorno.conexion.ejecutar.mockRejectedValueOnce(errorDuplicado);

      await expect(
        entorno.repositorio.crearPatron(3, 9, {
          nombre: 'Rotativo 2x1',
          descripcion: null,
          cicloDias: 1,
          dias: [
            { diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null },
          ],
        }),
      ).rejects.toThrow('Ya existe un patrón con ese nombre en este hospital');

      expect(entorno.transaccion).toHaveBeenCalledOnce();
    });

    it('falla si no puede recuperar el patrón recién creado', async () => {
      await expect(
        entorno.repositorio.crearPatron(3, 9, {
          nombre: 'Rotativo 2x1',
          descripcion: null,
          cicloDias: 1,
          dias: [
            { diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null },
          ],
        }),
      ).rejects.toThrow('No se pudo recuperar el patrón recién creado');
    });
  });

  describe('crearAsignacion', () => {
    const datos = {
      usuarioId: 12,
      patronId: 30,
      fechaInicio: '2026-11-01',
      fechaReferencia: '2026-11-01',
    };

    const filaAsignacion = {
      id: 25,
      usuario_id: 12,
      patron_id: 30,
      fecha_inicio: '2026-11-01',
      fecha_fin: null,
      fecha_referencia: '2026-11-01',
      configurado_por_id: 9,
    };

    it('crea la asignación y registra la auditoría en una transacción', async () => {
      entorno.conexion.filas.push(
        [{ id: 12 }],
        [{ id: 30, activo: 1 }],
        [],
        [filaAsignacion],
      );

      const resultado = await entorno.repositorio.crearAsignacion(3, 9, datos);

      expect(resultado).toEqual({
        id: 25,
        usuarioId: 12,
        patronId: 30,
        fechaInicio: '2026-11-01',
        fechaFin: null,
        fechaReferencia: '2026-11-01',
        configuradoPorId: 9,
      });
      expect(entorno.transaccion).toHaveBeenCalledOnce();
      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(4);
      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);

      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM usuarios'),
        [3, 12],
      );
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM patrones_jornada'),
        [3, 30],
      );
      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO asignaciones_jornada'),
        [3, 12, 30, '2026-11-01', '2026-11-01', 9],
      );
      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [3, 9, 25, JSON.stringify({ despues: datos })],
      );
    });

    it('rechaza la asignación cuando el empleado no existe en el hospital', async () => {
      entorno.conexion.filas.push([]);

      await expect(
        entorno.repositorio.crearAsignacion(3, 9, datos),
      ).rejects.toThrow('El empleado no existe en este hospital');

      expect(entorno.conexion.consultar).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza la asignación cuando el patrón no existe en el hospital', async () => {
      entorno.conexion.filas.push([{ id: 12 }], []);

      await expect(
        entorno.repositorio.crearAsignacion(3, 9, datos),
      ).rejects.toThrow('El patrón no existe en este hospital');

      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(2);
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza la asignación cuando el patrón está inactivo', async () => {
      entorno.conexion.filas.push(
        [{ id: 12 }],
        [{ id: 30, activo: 0 }],
      );

      await expect(
        entorno.repositorio.crearAsignacion(3, 9, datos),
      ).rejects.toThrow('No se puede asignar un patrón inactivo');

      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(2);
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza una asignación que se solapa con otra existente', async () => {
      entorno.conexion.filas.push(
        [{ id: 12 }],
        [{ id: 30, activo: 1 }],
        [{ id: 40 }],
      );

      await expect(
        entorno.repositorio.crearAsignacion(3, 9, datos),
      ).rejects.toThrow(
        'El empleado ya tiene una asignación de jornada que se solapa con la fecha indicada',
      );

      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(3);
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('falla si no puede recuperar la asignación recién creada', async () => {
      entorno.conexion.filas.push(
        [{ id: 12 }],
        [{ id: 30, activo: 1 }],
        [],
        [],
      );

      await expect(
        entorno.repositorio.crearAsignacion(3, 9, datos),
      ).rejects.toThrow('No se pudo recuperar la asignación recién creada');

      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);
    });
  });
  describe('cerrarAsignacion', () => {
    const datos = {
      asignacionId: 25,
      fechaFin: '2026-11-15',
    };

    const filaAnterior = {
      id: 25,
      usuario_id: 12,
      patron_id: 30,
      fecha_inicio: new Date('2026-11-01T12:00:00.000Z'),
      fecha_fin: null,
      fecha_referencia: '2026-11-01',
      configurado_por_id: 9,
    };

    const filaActualizada = {
      ...filaAnterior,
      fecha_fin: '2026-11-15',
    };

    it('cierra la asignación y registra la auditoría en una transacción', async () => {
      entorno.conexion.filas.push(
        [filaAnterior],
        [],
        [filaActualizada],
      );

      const resultado = await entorno.repositorio.cerrarAsignacion(3, 9, datos);

      expect(resultado).toEqual({
        id: 25,
        usuarioId: 12,
        patronId: 30,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-15',
        fechaReferencia: '2026-11-01',
        configuradoPorId: 9,
      });
      expect(entorno.transaccion).toHaveBeenCalledOnce();
      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(3);
      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);

      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        [3, 25],
      );
      expect(entorno.conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('id <> ?'),
        [3, 12, 25, '2026-11-15', '2026-11-01'],
      );
      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE asignaciones_jornada'),
        ['2026-11-15', 3, 25],
      );
      expect(entorno.conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          3,
          9,
          25,
          JSON.stringify({
            antes: {
              id: 25,
              usuarioId: 12,
              patronId: 30,
              fechaInicio: '2026-11-01',
              fechaFin: null,
              fechaReferencia: '2026-11-01',
              configuradoPorId: 9,
            },
            despues: datos,
          }),
        ],
      );
    });

    it('rechaza el cierre cuando la asignación no existe en el hospital', async () => {
      entorno.conexion.filas.push([]);

      await expect(
        entorno.repositorio.cerrarAsignacion(3, 9, datos),
      ).rejects.toThrow('La asignación no existe en este hospital');

      expect(entorno.conexion.consultar).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza el cierre cuando la asignación ya está cerrada', async () => {
      entorno.conexion.filas.push([{
        ...filaAnterior,
        fecha_fin: '2026-11-10',
      }]);

      await expect(
        entorno.repositorio.cerrarAsignacion(3, 9, datos),
      ).rejects.toThrow('La asignación ya está cerrada');

      expect(entorno.conexion.consultar).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza una fecha de cierre anterior al inicio de la asignación', async () => {
      entorno.conexion.filas.push([filaAnterior]);

      await expect(
        entorno.repositorio.cerrarAsignacion(3, 9, {
          asignacionId: 25,
          fechaFin: '2026-10-31',
        }),
      ).rejects.toThrow(
        'La fecha de cierre no puede ser anterior al inicio de la asignación',
      );

      expect(entorno.conexion.consultar).toHaveBeenCalledOnce();
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('rechaza el cierre cuando se solapa con otra asignación', async () => {
      entorno.conexion.filas.push(
        [filaAnterior],
        [{ id: 40 }],
      );

      await expect(
        entorno.repositorio.cerrarAsignacion(3, 9, datos),
      ).rejects.toThrow(
        'La fecha de cierre se solapa con otra asignación del empleado',
      );

      expect(entorno.conexion.consultar).toHaveBeenCalledTimes(2);
      expect(entorno.conexion.ejecutar).not.toHaveBeenCalled();
    });

    it('falla si no puede recuperar la asignación cerrada', async () => {
      entorno.conexion.filas.push(
        [filaAnterior],
        [],
        [],
      );

      await expect(
        entorno.repositorio.cerrarAsignacion(3, 9, datos),
      ).rejects.toThrow('No se pudo recuperar la asignación cerrada');

      expect(entorno.conexion.ejecutar).toHaveBeenCalledTimes(2);
    });
  });

  describe('obtenerAsignacionParaFecha', () => {
    const filaAsignacion = {
      id: 25,
      usuario_id: 12,
      patron_id: 30,
      fecha_inicio: '2026-11-01',
      fecha_fin: null,
      fecha_referencia: '2026-11-01',
      configurado_por_id: 9,
    };

    it('devuelve la asignación vigente para la fecha consultada', async () => {
      entorno.consultar.mockResolvedValueOnce([filaAsignacion]);

      const resultado = await entorno.repositorio.obtenerAsignacionParaFecha(
        3,
        12,
        '2026-11-10',
      );

      expect(resultado).toEqual({
        id: 25,
        usuarioId: 12,
        patronId: 30,
        fechaInicio: '2026-11-01',
        fechaFin: null,
        fechaReferencia: '2026-11-01',
        configuradoPorId: 9,
      });
      expect(entorno.consultar).toHaveBeenCalledWith(
        expect.stringContaining('fecha_inicio <= ?'),
        [3, 12, '2026-11-10', '2026-11-10'],
      );
    });

    it('devuelve null cuando no existe una asignación vigente', async () => {
      entorno.consultar.mockResolvedValueOnce([]);

      const resultado = await entorno.repositorio.obtenerAsignacionParaFecha(
        3,
        12,
        '2026-11-10',
      );

      expect(resultado).toBeNull();
      expect(entorno.consultar).toHaveBeenCalledOnce();
    });

    it('traduce los errores de consulta según el contexto de asignaciones', async () => {
      entorno.consultar.mockRejectedValueOnce(new Error('Error de conexión'));

      await expect(
        entorno.repositorio.obtenerAsignacionParaFecha(
          3,
          12,
          '2026-11-10',
        ),
      ).rejects.toThrow('Error de conexión');
    });
  });

  describe('manejo de errores de consultas', () => {
    it('traduce los errores al listar turnos', async () => {
      entorno.consultar.mockRejectedValueOnce(new Error('Error de conexión'));

      await expect(
        entorno.repositorio.listarTurnos(3),
      ).rejects.toThrow();
    });

    it('traduce los errores al obtener un patrón', async () => {
      entorno.consultar.mockRejectedValueOnce(new Error('Error de conexión'));

      await expect(
        entorno.repositorio.obtenerPatron(3, 30),
      ).rejects.toThrow();
    });

    it('traduce los errores al listar patrones', async () => {
      entorno.consultar.mockRejectedValueOnce(new Error('Error de conexión'));

      await expect(
        entorno.repositorio.listarPatrones(3),
      ).rejects.toThrow();
    });
  });

});


