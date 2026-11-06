// Pruebas del servicio de patrones rotativos: estructura del ciclo y aislamiento por empresa.
import { describe, expect, it, vi } from 'vitest';
import { JornadasService } from '../../../../src/modules/jornadas/jornadas.service';
import type {
  DatosNuevoPatron,
  PatronJornada,
  TurnoJornada,
} from '../../../../src/modules/jornadas/jornadas.dominio';
import type { IJornadasRepository } from '../../../../src/modules/jornadas/jornadas.repository';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';

const TURNO: TurnoJornada = {
  id: 1,
  nombre: 'Turno diurno',
  horaInicio: '08:00:00',
  horaFin: '16:00:00',
  minutosDescanso: 30,
  activo: true,
};

const PATRON: PatronJornada = {
  id: 10,
  nombre: 'Rotativo 2x2',
  descripcion: 'Dos dias de trabajo y dos de descanso',
  cicloDias: 4,
  activo: true,
  dias: [
    { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { id: 2, diaCiclo: 2, tipoDia: 'TURNO', turnoId: 1 },
    { id: 3, diaCiclo: 3, tipoDia: 'DESCANSO', turnoId: null },
    { id: 4, diaCiclo: 4, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

const NUEVO_PATRON: DatosNuevoPatron = {
  nombre: 'Rotativo 2x2',
  descripcion: 'Dos dias de trabajo y dos de descanso',
  cicloDias: 4,
  dias: [
    { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { diaCiclo: 2, tipoDia: 'TURNO', turnoId: 1 },
    { diaCiclo: 3, tipoDia: 'DESCANSO', turnoId: null },
    { diaCiclo: 4, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

function superadmin(empresaId = 5): UsuarioAutenticado {
  return { id: 99, empresaId, rol: 'SUPERADMIN', jti: 'jti-99', expira: 9_999_999_999 };
}

function crearEscenario() {
  const patrones = new Map<number, PatronJornada>([[10, { ...PATRON }]]);
  const turnos = new Map<number, TurnoJornada>([[1, { ...TURNO }]]);
  let siguienteId = 11;

  const obtenerTurno = vi.fn<IJornadasRepository['obtenerTurno']>(
    (empresaId, turnoId) => {
      const turno = turnos.get(turnoId);
      return Promise.resolve(
        empresaId === 5 && turno ? { ...turno } : null,
      );
    },
  );

  const listarTurnos = vi.fn<IJornadasRepository['listarTurnos']>(
    () => Promise.resolve([]),
  );

  const crearTurno = vi.fn<IJornadasRepository['crearTurno']>(
    () => Promise.resolve({ ...TURNO }),
  );

  const actualizarTurno = vi.fn<IJornadasRepository['actualizarTurno']>(
    () => Promise.resolve({ ...TURNO }),
  );

  const obtenerPatron = vi.fn<IJornadasRepository['obtenerPatron']>(
    (empresaId, patronId) => {
      const patron = patrones.get(patronId);
      return Promise.resolve(
        empresaId === 5 && patron ? { ...patron } : null,
      );
    },
  );

  const listarPatrones = vi.fn<IJornadasRepository['listarPatrones']>(
    (empresaId, incluirInactivos = false) => {
      if (empresaId !== 5) return Promise.resolve([]);

      return Promise.resolve(
        [...patrones.values()]
          .filter((patron) => incluirInactivos || patron.activo)
          .map((patron) => ({ ...patron })),
      );
    },
  );

  const crearPatron = vi.fn<IJornadasRepository['crearPatron']>(
    (empresaId, _usuarioId, datos) => {
      const creado: PatronJornada = {
        id: siguienteId++,
        ...datos,
        activo: true,
        dias: datos.dias.map((dia, indice) => ({
          id: indice + 1,
          ...dia,
        })),
      };

      if (empresaId === 5) patrones.set(creado.id, creado);
      return Promise.resolve({ ...creado });
    },
  );

  const crearAsignacion = vi.fn<IJornadasRepository['crearAsignacion']>(
    () => Promise.reject(
      new Error('Método de asignaciones no configurado en este escenario'),
    ),
  );

  const cerrarAsignacion = vi.fn<IJornadasRepository['cerrarAsignacion']>(
    () => Promise.reject(
      new Error('Método de cierre no configurado en este escenario'),
    ),
  );

  const obtenerAsignacionParaFecha = vi.fn<
    IJornadasRepository['obtenerAsignacionParaFecha']
  >(() => Promise.resolve(null));

  const repositorio: IJornadasRepository = {
    obtenerTurno,
    listarTurnos,
    crearTurno,
    actualizarTurno,
    obtenerPatron,
    listarPatrones,
    crearPatron,
    crearAsignacion,
    cerrarAsignacion,
    obtenerAsignacionParaFecha,
  };

  return {
    patrones,
    turnos,
    repositorio,
    espias: { crearPatron },
    servicio: new JornadasService({ repositorio }),
  };
}
describe('obtener y listar patrones', () => {
  it('obtiene un patron de la empresa autenticada', async () => {
    const { servicio } = crearEscenario();

    await expect(servicio.obtenerPatron(superadmin(), 10))
      .resolves.toEqual(PATRON);
  });

  it('rechaza un patron inexistente o de otra empresa', async () => {
    const { servicio } = crearEscenario();

    await expect(servicio.obtenerPatron(superadmin(), 999))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    await expect(servicio.obtenerPatron(superadmin(6), 10))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('lista los patrones activos por defecto', async () => {
    const { servicio, patrones } = crearEscenario();
    patrones.set(11, { ...PATRON, id: 11, nombre: 'Inactivo', activo: false });

    await expect(servicio.listarPatrones(superadmin()))
      .resolves.toEqual([PATRON]);
  });

  it('permite incluir patrones inactivos', async () => {
    const { servicio, patrones } = crearEscenario();
    patrones.set(11, { ...PATRON, id: 11, nombre: 'Inactivo', activo: false });

    await expect(servicio.listarPatrones(superadmin(), true))
      .resolves.toHaveLength(2);
  });

  it('no mezcla patrones de otras empresas', async () => {
    const { servicio } = crearEscenario();

    await expect(servicio.listarPatrones(superadmin(6)))
      .resolves.toEqual([]);
  });
});

describe('crear patrones', () => {
  it('crea un patron con turnos y descansos', async () => {
    const { servicio, espias } = crearEscenario();

    const creado = await servicio.crearPatron(superadmin(), NUEVO_PATRON);

    expect(creado).toMatchObject({
      id: 11,
      nombre: NUEVO_PATRON.nombre,
      cicloDias: 4,
      activo: true,
    });
    expect(creado.dias).toHaveLength(4);
    expect(espias.crearPatron).toHaveBeenCalledWith(5, 99, NUEVO_PATRON);
  });

  it('normaliza el nombre y ordena las posiciones del ciclo', async () => {
    const { servicio, espias } = crearEscenario();
    const datos = {
      ...NUEVO_PATRON,
      nombre: '  Rotativo  ',
      dias: [...NUEVO_PATRON.dias].reverse(),
    };

    await servicio.crearPatron(superadmin(), datos);

    expect(espias.crearPatron).toHaveBeenCalledWith(5, 99, {
      ...datos,
      nombre: 'Rotativo',
      dias: [...datos.dias].sort((a, b) => a.diaCiclo - b.diaCiclo),
    });
  });

  it.each([
    ['nombre vacio', { ...NUEVO_PATRON, nombre: '  ' }],
    ['nombre demasiado largo', { ...NUEVO_PATRON, nombre: 'P'.repeat(101) }],
    ['descripcion demasiado larga', { ...NUEVO_PATRON, descripcion: 'D'.repeat(501) }],
    ['ciclo menor que uno', { ...NUEVO_PATRON, cicloDias: 0 }],
    ['ciclo mayor que 366', { ...NUEVO_PATRON, cicloDias: 367 }],
    ['ciclo decimal', { ...NUEVO_PATRON, cicloDias: 4.5 }],
    ['cantidad de dias incompleta', { ...NUEVO_PATRON, dias: NUEVO_PATRON.dias.slice(0, 3) }],
    ['posicion fuera del ciclo', {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 0 ? { ...dia, diaCiclo: 5 } : dia),
    }],
    ['posiciones duplicadas', {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 1 ? { ...dia, diaCiclo: 1 } : dia),
    }],
    ['turno sin identificador', {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 0 ? { ...dia, turnoId: null } : dia),
    }],
    ['descanso con turno asociado', {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 2 ? { ...dia, turnoId: 1 } : dia),
    }],
    ['tipo de dia invalido', {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 0 ? { ...dia, tipoDia: 'LIBRE' as 'TURNO' } : dia),
    }],
  ] as [string, DatosNuevoPatron][])('rechaza %s', async (_caso, datos) => {
    const { servicio, espias } = crearEscenario();

    await expect(servicio.crearPatron(superadmin(), datos))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('rechaza un turno que no pertenece al hospital', async () => {
    const { servicio, espias } = crearEscenario();
    const datos = {
      ...NUEVO_PATRON,
      dias: NUEVO_PATRON.dias.map((dia, indice) =>
        indice === 0 ? { ...dia, turnoId: 999 } : dia),
    };

    await expect(servicio.crearPatron(superadmin(), datos))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('rechaza un turno inactivo', async () => {
    const { servicio, espias, turnos } = crearEscenario();
    turnos.set(1, { ...TURNO, activo: false });

    await expect(servicio.crearPatron(superadmin(), NUEVO_PATRON))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('no permite crear un patron usando turnos de otra empresa', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(servicio.crearPatron(superadmin(6), NUEVO_PATRON))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });
});


