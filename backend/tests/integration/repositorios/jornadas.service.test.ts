// Pruebas de integración del servicio de jornadas con repositorio y MySQL reales.
// Verifica validaciones del dominio y cálculo de ciclos rotativos.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { JornadasRepository } from '../../../src/modules/jornadas/jornadas.repository';
import { JornadasService } from '../../../src/modules/jornadas/jornadas.service';
import type { UsuarioAutenticado } from '../../../src/shared/types/autenticacion';
import type { DatosNuevoPatron } from '../../../src/modules/jornadas/jornadas.dominio';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new JornadasRepository(bd);
const servicio = new JornadasService({ repositorio });

let actor: UsuarioAutenticado;
let empleadoId: number;

async function prepararActores(): Promise<void> {
  const configuradorId = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0300000001',
    rol: 'SUPERADMIN',
  });

  empleadoId = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0300000002',
  });

  actor = {
    id: configuradorId,
    empresaId: IDS.empresaA,
    rol: 'SUPERADMIN',
    jti: 'jti-integracion-jornadas',
    expira: 9_999_999_999,
  };
}

async function crearTurnoNocturno(): Promise<number> {
  const turno = await servicio.crearTurno(actor, {
    nombre: 'Turno nocturno',
    horaInicio: '22:00:00',
    horaFin: '06:00:00',
    minutosDescanso: 30,
  });

  return turno.id;
}

async function crearPatronRotativo(turnoId: number): Promise<number> {
  const patron = await servicio.crearPatron(actor, {
    nombre: 'Rotación de tres días',
    descripcion: 'Un turno, un descanso y otro turno',
    cicloDias: 3,
    dias: [
      { diaCiclo: 1, tipoDia: 'TURNO', turnoId },
      { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
      { diaCiclo: 3, tipoDia: 'TURNO', turnoId },
    ],
  });

  return patron.id;
}

describe('JornadasService - integración MySQL', () => {
  beforeEach(async () => {
    await resetearDatos();
    await prepararActores();
  });

  afterAll(async () => {
    await cerrarBaseDatos();
  });

  describe('validación de turnos y patrones', () => {
    it('rechaza turnos con horas iguales', async () => {
      await expect(
        servicio.crearTurno(actor, {
          nombre: 'Turno inválido',
          horaInicio: '08:00:00',
          horaFin: '08:00:00',
          minutosDescanso: 0,
        }),
      ).rejects.toThrow('no pueden ser iguales');

      const turnos = await bd.consultar<{ total: number }>(
        'SELECT COUNT(*) AS total FROM turnos WHERE empresa_id = ?',
        [IDS.empresaA],
      );

      expect(Number(turnos[0]?.total)).toBe(0);
    });

    it('rechaza un patrón con posiciones duplicadas', async () => {
      const turnoId = await crearTurnoNocturno();

      const datos: DatosNuevoPatron = {
        nombre: 'Patrón duplicado',
        descripcion: null,
        cicloDias: 2,
        dias: [
          { diaCiclo: 1, tipoDia: 'TURNO', turnoId },
          { diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null },
        ],
      };

      await expect(servicio.crearPatron(actor, datos))
        .rejects.toThrow('posiciones de ciclo duplicadas');
    });

    it('rechaza un patrón que no contiene todos los días del ciclo', async () => {
      const turnoId = await crearTurnoNocturno();

      await expect(
        servicio.crearPatron(actor, {
          nombre: 'Patrón incompleto',
          descripcion: null,
          cicloDias: 3,
          dias: [
            { diaCiclo: 1, tipoDia: 'TURNO', turnoId },
            { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
          ],
        }),
      ).rejects.toThrow('exactamente un registro');
    });

    it('rechaza utilizar un turno de otro hospital', async () => {
      const usuarioEmpresaB = await insertarUsuario({
        empresaId: IDS.empresaB,
        areaId: IDS.areaB1,
        cargoId: IDS.cargoB1,
        cedula: '0400000001',
        rol: 'SUPERADMIN',
      });

      const turnoEmpresaB = await bd.ejecutar(
        `INSERT INTO turnos (
           empresa_id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
         ) VALUES (?, ?, ?, ?, ?, 1)`,
        [IDS.empresaB, 'Turno externo', '08:00:00', '16:00:00', 30],
      );

      expect(usuarioEmpresaB).toBeGreaterThan(0);

      await expect(
        servicio.crearPatron(actor, {
          nombre: 'Patrón externo',
          descripcion: null,
          cicloDias: 1,
          dias: [
            {
              diaCiclo: 1,
              tipoDia: 'TURNO',
              turnoId: turnoEmpresaB.idInsertado,
            },
          ],
        }),
      ).rejects.toThrow('no existe en este hospital');
    });
  });

  describe('asignaciones y cálculo del ciclo', () => {
    it('calcula turnos y descansos según la posición del ciclo', async () => {
      const turnoId = await crearTurnoNocturno();
      const patronId = await crearPatronRotativo(turnoId);

      await servicio.crearAsignacion(actor, {
        usuarioId: empleadoId,
        patronId,
        fechaInicio: '2026-01-10',
        fechaReferencia: '2026-01-10',
      });

      const primerDia = await servicio.obtenerJornadaParaFecha(
        actor,
        empleadoId,
        '2026-01-10',
      );

      expect(primerDia.esDescanso).toBe(false);
      expect(primerDia.turno?.id).toBe(turnoId);
      expect(primerDia.minutosLaborables).toBe(450);

      const segundoDia = await servicio.obtenerJornadaParaFecha(
        actor,
        empleadoId,
        '2026-01-11',
      );

      expect(segundoDia).toMatchObject({
        fecha: '2026-01-11',
        esDescanso: true,
        turno: null,
        minutosLaborables: 0,
      });

      const tercerDia = await servicio.obtenerJornadaParaFecha(
        actor,
        empleadoId,
        '2026-01-12',
      );

      expect(tercerDia.esDescanso).toBe(false);
      expect(tercerDia.minutosLaborables).toBe(450);
    });

    it('calcula correctamente fechas anteriores a la referencia del ciclo', async () => {
      const turnoId = await crearTurnoNocturno();
      const patronId = await crearPatronRotativo(turnoId);

      await servicio.crearAsignacion(actor, {
        usuarioId: empleadoId,
        patronId,
        fechaInicio: '2026-01-01',
        fechaReferencia: '2026-01-10',
      });

      const jornada = await servicio.obtenerJornadaParaFecha(
        actor,
        empleadoId,
        '2026-01-09',
      );

      expect(jornada.esDescanso).toBe(false);
      expect(jornada.turno?.id).toBe(turnoId);
      expect(jornada.minutosLaborables).toBe(450);
    });

    it('rechaza fechas de calendario inexistentes al asignar', async () => {
      const turnoId = await crearTurnoNocturno();
      const patronId = await crearPatronRotativo(turnoId);

      await expect(
        servicio.crearAsignacion(actor, {
          usuarioId: empleadoId,
          patronId,
          fechaInicio: '2026-02-30',
          fechaReferencia: '2026-02-01',
        }),
      ).rejects.toThrow('fechas de asignación');
    });

    it('rechaza consultar una fecha inválida', async () => {
      await expect(
        servicio.obtenerJornadaParaFecha(actor, empleadoId, '2026-02-30'),
      ).rejects.toThrow('fecha válida');
    });

    it('rechaza asignar un patrón inactivo', async () => {
      const turnoId = await crearTurnoNocturno();
      const patronId = await crearPatronRotativo(turnoId);

      await bd.ejecutar(
        'UPDATE patrones_jornada SET activo = 0 WHERE empresa_id = ? AND id = ?',
        [IDS.empresaA, patronId],
      );

      await expect(
        servicio.crearAsignacion(actor, {
          usuarioId: empleadoId,
          patronId,
          fechaInicio: '2026-06-01',
          fechaReferencia: '2026-06-01',
        }),
      ).rejects.toThrow('patrón inactivo');
    });

    it('rechaza consultar jornadas sin asignación para la fecha', async () => {
      await expect(
        servicio.obtenerJornadaParaFecha(actor, empleadoId, '2026-07-01'),
      ).rejects.toThrow('no tiene una jornada asignada');
    });
  });
});
