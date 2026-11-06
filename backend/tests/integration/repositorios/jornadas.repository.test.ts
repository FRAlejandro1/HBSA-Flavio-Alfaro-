// Pruebas de integración del repositorio de jornadas con MySQL real.
// Verifica persistencia, aislamiento multiempresa, asignaciones y auditoría.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { JornadasRepository } from '../../../src/modules/jornadas/jornadas.repository';
import type {
  DatosActualizarTurno,
  DatosNuevoPatron,
  DatosNuevoTurno,
} from '../../../src/modules/jornadas/jornadas.dominio';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new JornadasRepository(bd);

const turnoBase: DatosNuevoTurno = {
  nombre: 'Turno diurno',
  horaInicio: '07:00',
  horaFin: '15:00',
  minutosDescanso: 30,
};

async function crearActores(empresaId: number = IDS.empresaA) {
  const configuradorId = await insertarUsuario({
    empresaId,
    areaId: empresaId === IDS.empresaA ? IDS.areaA1 : IDS.areaB1,
    cargoId: empresaId === IDS.empresaA ? IDS.cargoA1 : IDS.cargoB1,
    cedula: empresaId === IDS.empresaA ? '0100000001' : '0200000001',
    rol: 'SUPERADMIN',
  });

  const empleadoId = await insertarUsuario({
    empresaId,
    areaId: empresaId === IDS.empresaA ? IDS.areaA1 : IDS.areaB1,
    cargoId: empresaId === IDS.empresaA ? IDS.cargoA1 : IDS.cargoB1,
    cedula: empresaId === IDS.empresaA ? '0100000002' : '0200000002',
  });

  return { configuradorId, empleadoId };
}

async function crearPatron(
  empresaId: number,
  configuradorId: number,
  turnoId: number,
) {
  const datos: DatosNuevoPatron = {
    nombre: 'Patrón rotativo 24 horas',
    descripcion: 'Ciclo de trabajo y descanso',
    cicloDias: 2,
    dias: [
      { diaCiclo: 1, tipoDia: 'TURNO', turnoId },
      { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
    ],
  };

  return repositorio.crearPatron(empresaId, configuradorId, datos);
}

describe('JornadasRepository - integración MySQL', () => {
  beforeEach(async () => {
    await resetearDatos();
  });

  afterAll(async () => {
    await cerrarBaseDatos();
  });

  describe('turnos', () => {
    it('crea, consulta y actualiza un turno registrando auditoría', async () => {
      const { configuradorId } = await crearActores();

      const creado = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      expect(creado.id).toBeGreaterThan(0);
      expect(creado.nombre).toBe(turnoBase.nombre);
      expect(creado.horaInicio).toBe('07:00:00');
      expect(creado.horaFin).toBe('15:00:00');
      expect(creado.minutosDescanso).toBe(30);
      expect(creado.activo).toBe(true);

      const encontrado = await repositorio.obtenerTurno(IDS.empresaA, creado.id);
      expect(encontrado).toEqual(creado);

      const datosActualizados: DatosActualizarTurno = {
        nombre: 'Turno matutino',
        horaInicio: '06:00',
        horaFin: '14:00',
        minutosDescanso: 45,
        activo: false,
      };

      const actualizado = await repositorio.actualizarTurno(
        IDS.empresaA,
        configuradorId,
        creado.id,
        datosActualizados,
      );

      expect(actualizado.nombre).toBe('Turno matutino');
      expect(actualizado.horaInicio).toBe('06:00:00');
      expect(actualizado.horaFin).toBe('14:00:00');
      expect(actualizado.minutosDescanso).toBe(45);
      expect(actualizado.activo).toBe(false);

      const auditoria = await bd.consultar<{ accion: string }>(
        `SELECT accion
         FROM audit_log
         WHERE empresa_id = ? AND entidad_id = ?
           AND entidad = 'TURNO' AND accion IN ('TURNO_CREADO', 'TURNO_ACTUALIZADO')
         ORDER BY id ASC`,
        [IDS.empresaA, creado.id],
      );

      expect(auditoria.map((registro) => registro.accion)).toEqual([
        'TURNO_CREADO',
        'TURNO_ACTUALIZADO',
      ]);
    });

    it('excluye turnos inactivos por defecto y permite incluirlos', async () => {
      const { configuradorId } = await crearActores();

      const creado = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      await repositorio.actualizarTurno(
        IDS.empresaA,
        configuradorId,
        creado.id,
        { ...turnoBase, activo: false },
      );

      expect(await repositorio.listarTurnos(IDS.empresaA)).toEqual([]);

      const incluidos = await repositorio.listarTurnos(IDS.empresaA, true);
      expect(incluidos).toHaveLength(1);
      expect(incluidos[0]?.activo).toBe(false);
    });

    it('impide consultar un turno perteneciente a otro hospital', async () => {
      const actoresA = await crearActores(IDS.empresaA);
      const actoresB = await crearActores(IDS.empresaB);

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        actoresA.configuradorId,
        turnoBase,
      );

      const turnoEmpresaB = await repositorio.crearTurno(
        IDS.empresaB,
        actoresB.configuradorId,
        turnoBase,
      );

      expect(await repositorio.obtenerTurno(IDS.empresaB, turno.id)).toBeNull();
      expect(await repositorio.obtenerTurno(IDS.empresaA, turnoEmpresaB.id)).toBeNull();
      expect(await repositorio.listarTurnos(IDS.empresaB)).toHaveLength(1);
    });
  });

  describe('patrones de jornada', () => {
    it('crea y recupera un patrón con sus días ordenados', async () => {
      const { configuradorId } = await crearActores();

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        configuradorId,
        turno.id,
      );

      expect(patron.id).toBeGreaterThan(0);
      expect(patron.cicloDias).toBe(2);
      expect(patron.dias).toHaveLength(2);
      expect(patron.dias[0]).toMatchObject({
        diaCiclo: 1,
        tipoDia: 'TURNO',
        turnoId: turno.id,
      });
      expect(patron.dias[1]).toMatchObject({
        diaCiclo: 2,
        tipoDia: 'DESCANSO',
        turnoId: null,
      });

      const encontrado = await repositorio.obtenerPatron(
        IDS.empresaA,
        patron.id,
      );

      expect(encontrado).toEqual(patron);

      const lista = await repositorio.listarPatrones(IDS.empresaA);
      expect(lista).toHaveLength(1);
      expect(lista[0]).toEqual(patron);
    });

    it('mantiene aislados los patrones entre hospitales', async () => {
      const actoresA = await crearActores(IDS.empresaA);
      const actoresB = await crearActores(IDS.empresaB);

      const turnoA = await repositorio.crearTurno(
        IDS.empresaA,
        actoresA.configuradorId,
        turnoBase,
      );

      const patronA = await crearPatron(
        IDS.empresaA,
        actoresA.configuradorId,
        turnoA.id,
      );

      const turnoB = await repositorio.crearTurno(
        IDS.empresaB,
        actoresB.configuradorId,
        turnoBase,
      );

      const patronB = await crearPatron(
        IDS.empresaB,
        actoresB.configuradorId,
        turnoB.id,
      );

      expect(await repositorio.obtenerPatron(IDS.empresaB, patronA.id)).toBeNull();
      expect(await repositorio.obtenerPatron(IDS.empresaA, patronB.id)).toBeNull();
      expect(await repositorio.listarPatrones(IDS.empresaA)).toHaveLength(1);
      expect(await repositorio.listarPatrones(IDS.empresaB)).toHaveLength(1);
    });
  });

  describe('asignaciones', () => {
    it('crea, consulta por fecha y cierra una asignación conservando su historial', async () => {
      const { configuradorId, empleadoId } = await crearActores();

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        configuradorId,
        turno.id,
      );

      const asignacion = await repositorio.crearAsignacion(
        IDS.empresaA,
        configuradorId,
        {
          usuarioId: empleadoId,
          patronId: patron.id,
          fechaInicio: '2026-01-10',
          fechaReferencia: '2026-01-10',
        },
      );

      expect(asignacion).toMatchObject({
        usuarioId: empleadoId,
        patronId: patron.id,
        fechaInicio: '2026-01-10',
        fechaFin: null,
        fechaReferencia: '2026-01-10',
        configuradoPorId: configuradorId,
      });

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaA,
          empleadoId,
          '2026-01-09',
        ),
      ).toBeNull();

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaA,
          empleadoId,
          '2026-01-10',
        ),
      ).toEqual(asignacion);

      const cerrada = await repositorio.cerrarAsignacion(
        IDS.empresaA,
        configuradorId,
        {
          asignacionId: asignacion.id,
          fechaFin: '2026-01-20',
        },
      );

      expect(cerrada.fechaFin).toBe('2026-01-20');

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaA,
          empleadoId,
          '2026-01-20',
        ),
      ).toEqual(cerrada);

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaA,
          empleadoId,
          '2026-01-21',
        ),
      ).toBeNull();

      const auditoria = await bd.consultar<{ accion: string }>(
        `SELECT accion
         FROM audit_log
         WHERE empresa_id = ? AND entidad_id = ?
           AND accion IN ('JORNADA_ASIGNADA', 'JORNADA_ASIGNACION_CERRADA')
         ORDER BY id ASC`,
        [IDS.empresaA, asignacion.id],
      );

      expect(auditoria.map((registro) => registro.accion)).toEqual([
        'JORNADA_ASIGNADA',
        'JORNADA_ASIGNACION_CERRADA',
      ]);
    });

    it('serializa asignaciones concurrentes y permite solamente una', async () => {
      const { configuradorId, empleadoId } = await crearActores();

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        configuradorId,
        turno.id,
      );

      const resultados = await Promise.allSettled([
        repositorio.crearAsignacion(
          IDS.empresaA,
          configuradorId,
          {
            usuarioId: empleadoId,
            patronId: patron.id,
            fechaInicio: '2026-05-01',
            fechaReferencia: '2026-05-01',
          },
        ),
        repositorio.crearAsignacion(
          IDS.empresaA,
          configuradorId,
          {
            usuarioId: empleadoId,
            patronId: patron.id,
            fechaInicio: '2026-05-01',
            fechaReferencia: '2026-05-01',
          },
        ),
      ]);

      expect(resultados.filter((resultado) => resultado.status === 'fulfilled'))
        .toHaveLength(1);
      expect(resultados.filter((resultado) => resultado.status === 'rejected'))
        .toHaveLength(1);

      const asignaciones = await bd.consultar<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM asignaciones_jornada
         WHERE empresa_id = ? AND usuario_id = ?`,
        [IDS.empresaA, empleadoId],
      );

      expect(Number(asignaciones[0]?.total)).toBe(1);
    });
    it('rechaza una segunda asignación que se solapa con la vigente', async () => {
      const { configuradorId, empleadoId } = await crearActores();

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        configuradorId,
        turno.id,
      );

      await repositorio.crearAsignacion(
        IDS.empresaA,
        configuradorId,
        {
          usuarioId: empleadoId,
          patronId: patron.id,
          fechaInicio: '2026-02-01',
          fechaReferencia: '2026-02-01',
        },
      );

      await expect(
        repositorio.crearAsignacion(
          IDS.empresaA,
          configuradorId,
          {
            usuarioId: empleadoId,
            patronId: patron.id,
            fechaInicio: '2026-02-15',
            fechaReferencia: '2026-02-15',
          },
        ),
      ).rejects.toThrow('se solapa');
    });

    it('rechaza cerrar una asignación que ya está cerrada', async () => {
      const { configuradorId, empleadoId } = await crearActores();

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        configuradorId,
        turno.id,
      );

      const asignacion = await repositorio.crearAsignacion(
        IDS.empresaA,
        configuradorId,
        {
          usuarioId: empleadoId,
          patronId: patron.id,
          fechaInicio: '2026-03-01',
          fechaReferencia: '2026-03-01',
        },
      );

      await repositorio.cerrarAsignacion(
        IDS.empresaA,
        configuradorId,
        {
          asignacionId: asignacion.id,
          fechaFin: '2026-03-10',
        },
      );

      await expect(
        repositorio.cerrarAsignacion(
          IDS.empresaA,
          configuradorId,
          {
            asignacionId: asignacion.id,
            fechaFin: '2026-03-12',
          },
        ),
      ).rejects.toThrow('ya está cerrada');
    });

    it('no permite consultar asignaciones desde otro hospital', async () => {
      const actoresA = await crearActores(IDS.empresaA);
      const actoresB = await crearActores(IDS.empresaB);

      const turno = await repositorio.crearTurno(
        IDS.empresaA,
        actoresA.configuradorId,
        turnoBase,
      );

      const patron = await crearPatron(
        IDS.empresaA,
        actoresA.configuradorId,
        turno.id,
      );

      await repositorio.crearAsignacion(
        IDS.empresaA,
        actoresA.configuradorId,
        {
          usuarioId: actoresA.empleadoId,
          patronId: patron.id,
          fechaInicio: '2026-04-01',
          fechaReferencia: '2026-04-01',
        },
      );

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaB,
          actoresA.empleadoId,
          '2026-04-01',
        ),
      ).toBeNull();

      expect(
        await repositorio.obtenerAsignacionParaFecha(
          IDS.empresaB,
          actoresB.empleadoId,
          '2026-04-01',
        ),
      ).toBeNull();
    });
  });
});

