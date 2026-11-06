// Pruebas del servicio de asignaciones de jornadas.
// Verifica validaciones, aislamiento por empresa y cálculo del ciclo rotativo.

import { describe, expect, it, vi } from 'vitest';
import { JornadasService } from '../../../../src/modules/jornadas/jornadas.service';
import type {
  AsignacionJornada,
  DatosCerrarAsignacion,
  DatosNuevaAsignacion,
  JornadaDeFecha,
  PatronJornada,
  TurnoJornada,
} from '../../../../src/modules/jornadas/jornadas.dominio';
import type { IJornadasRepository } from '../../../../src/modules/jornadas/jornadas.repository';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';

const TURNO_DIURNO: TurnoJornada = {
  id: 1,
  nombre: 'Turno diurno',
  horaInicio: '08:00:00',
  horaFin: '16:00:00',
  minutosDescanso: 30,
  activo: true,
};

const TURNO_NOCTURNO: TurnoJornada = {
  id: 2,
  nombre: 'Turno nocturno',
  horaInicio: '22:00:00',
  horaFin: '06:00:00',
  minutosDescanso: 45,
  activo: true,
};

const PATRON: PatronJornada = {
  id: 7,
  nombre: 'Rotativo de tres días',
  descripcion: 'Dos turnos y un descanso',
  cicloDias: 3,
  activo: true,
  dias: [
    { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { id: 2, diaCiclo: 2, tipoDia: 'TURNO', turnoId: 2 },
    { id: 3, diaCiclo: 3, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

const ASIGNACION: AsignacionJornada = {
  id: 31,
  usuarioId: 12,
  patronId: 7,
  fechaInicio: '2026-01-01',
  fechaFin: null,
  fechaReferencia: '2026-01-01',
  configuradoPorId: 99,
};

const NUEVA_ASIGNACION: DatosNuevaAsignacion = {
  usuarioId: 12,
  patronId: 7,
  fechaInicio: '2026-01-01',
  fechaReferencia: '2026-01-01',
};

function superadmin(empresaId = 5): UsuarioAutenticado {
  return {
    id: 99,
    empresaId,
    rol: 'SUPERADMIN',
    jti: 'jti-99',
    expira: 9_999_999_999,
  };
}

function crearEscenario() {
  const turnos = new Map<number, TurnoJornada>([
    [1, { ...TURNO_DIURNO }],
    [2, { ...TURNO_NOCTURNO }],
  ]);

  let patron: PatronJornada | null = { ...PATRON, dias: [...PATRON.dias] };
  let asignacion: AsignacionJornada | null = { ...ASIGNACION };

  // Cada espía se declara independientemente para facilitar las aserciones.
  const obtenerPatron = vi.fn<IJornadasRepository['obtenerPatron']>(
    (empresaId, patronId) => {
      const patronActual = patron;

      return Promise.resolve(
        empresaId !== 5 || patronActual === null || patronActual.id !== patronId
          ? null
          : { ...patronActual, dias: [...patronActual.dias] },
      );
    },
  );

  const crearAsignacion = vi.fn<IJornadasRepository['crearAsignacion']>(
    (empresaId, usuarioId, datos) => {
      if (empresaId !== 5) {
        return Promise.reject(new Error('Empresa incorrecta'));
      }

      const creada: AsignacionJornada = {
        id: 31,
        usuarioId: datos.usuarioId,
        patronId: datos.patronId,
        fechaInicio: datos.fechaInicio,
        fechaFin: null,
        fechaReferencia: datos.fechaReferencia,
        configuradoPorId: usuarioId,
      };

      asignacion = creada;
      return Promise.resolve({ ...creada });
    },
  );

  const cerrarAsignacion = vi.fn<IJornadasRepository['cerrarAsignacion']>(
    (_empresaId, _usuarioId, datos) => {
      if (asignacion === null || asignacion.id !== datos.asignacionId) {
        return Promise.reject(new Error('La asignación no existe'));
      }

      const cerrada: AsignacionJornada = {
        ...asignacion,
        fechaFin: datos.fechaFin,
      };

      asignacion = cerrada;
      return Promise.resolve({ ...cerrada });
    },
  );

  const obtenerAsignacionParaFecha = vi.fn<
    IJornadasRepository['obtenerAsignacionParaFecha']
  >((empresaId, usuarioId, fecha) => {
    if (
      empresaId !== 5 ||
      asignacion === null ||
      asignacion.usuarioId !== usuarioId ||
      fecha < asignacion.fechaInicio ||
      (asignacion.fechaFin !== null && fecha > asignacion.fechaFin)
    ) {
      return Promise.resolve(null);
    }

    return Promise.resolve({ ...asignacion });
  });

  const repositorio: IJornadasRepository = {
    obtenerTurno: vi.fn<IJornadasRepository['obtenerTurno']>(
      (empresaId, turnoId) => {
        const turno = turnos.get(turnoId);
        return Promise.resolve(
          empresaId === 5 && turno ? { ...turno } : null,
        );
      },
    ),
    listarTurnos: vi.fn<IJornadasRepository['listarTurnos']>(
      () => Promise.resolve([]),
    ),
    crearTurno: vi.fn<IJornadasRepository['crearTurno']>(
      () => Promise.resolve({ ...TURNO_DIURNO }),
    ),
    actualizarTurno: vi.fn<IJornadasRepository['actualizarTurno']>(
      () => Promise.resolve({ ...TURNO_DIURNO }),
    ),
    obtenerPatron,
    listarPatrones: vi.fn<IJornadasRepository['listarPatrones']>(
      () => Promise.resolve([]),
    ),
    crearPatron: vi.fn<IJornadasRepository['crearPatron']>(
      () => Promise.resolve({ ...PATRON, dias: [...PATRON.dias] }),
    ),
    crearAsignacion,
    cerrarAsignacion,
    obtenerAsignacionParaFecha,
  };

  return {
    turnos,
    repositorio,
    espias: {
      obtenerPatron,
      crearAsignacion,
      cerrarAsignacion,
      obtenerAsignacionParaFecha,
    },
    servicio: new JornadasService({ repositorio }),
    establecerPatron: (nuevo: PatronJornada | null) => {
      patron = nuevo;
    },
    establecerAsignacion: (nueva: AsignacionJornada | null) => {
      asignacion = nueva;
    },
  };
}
describe('crearAsignacion', () => {
  it('crea una asignación para un empleado del hospital', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(), NUEVA_ASIGNACION),
    ).resolves.toEqual(ASIGNACION);

    expect(espias.obtenerPatron).toHaveBeenCalledWith(5, 7);
    expect(espias.crearAsignacion).toHaveBeenCalledWith(
      5,
      99,
      NUEVA_ASIGNACION,
    );
  });

  it('rechaza un empleado con identificador inválido', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(), {
        ...NUEVA_ASIGNACION,
        usuarioId: 0,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });

  it('rechaza un patrón con identificador inválido', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(), {
        ...NUEVA_ASIGNACION,
        patronId: -1,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.obtenerPatron).not.toHaveBeenCalled();
    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });

  it.each([
    ['formato incorrecto', '01/01/2026'],
    ['día inexistente', '2026-02-30'],
    ['mes inexistente', '2026-13-01'],
  ])('rechaza la fecha de inicio si tiene %s', async (_caso, fecha) => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(), {
        ...NUEVA_ASIGNACION,
        fechaInicio: fecha,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de referencia inválida', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(), {
        ...NUEVA_ASIGNACION,
        fechaReferencia: '2026-02-29',
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });

  it('rechaza un patrón inexistente o de otra empresa', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearAsignacion(superadmin(6), NUEVA_ASIGNACION),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });

  it('rechaza asignar un patrón inactivo', async () => {
    const { servicio, espias, establecerPatron } = crearEscenario();
    establecerPatron({ ...PATRON, activo: false });

    await expect(
      servicio.crearAsignacion(superadmin(), NUEVA_ASIGNACION),
    ).rejects.toThrow('No se puede asignar un patrón inactivo');

    expect(espias.crearAsignacion).not.toHaveBeenCalled();
  });
});

describe('cerrarAsignacion', () => {
  const datosCierre: DatosCerrarAsignacion = {
    asignacionId: 31,
    fechaFin: '2026-06-30',
  };

  it('cierra una asignación delegando la persistencia al repositorio', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.cerrarAsignacion(superadmin(), datosCierre),
    ).resolves.toMatchObject({
      ...ASIGNACION,
      fechaFin: '2026-06-30',
    });

    expect(espias.cerrarAsignacion).toHaveBeenCalledWith(
      5,
      99,
      datosCierre,
    );
  });

  it('rechaza un identificador de asignación inválido', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.cerrarAsignacion(superadmin(), {
        ...datosCierre,
        asignacionId: 0,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.cerrarAsignacion).not.toHaveBeenCalled();
  });

  it.each([
    ['formato incorrecto', '30-06-2026'],
    ['día inexistente', '2026-06-31'],
    ['mes inexistente', '2026-14-01'],
  ])('rechaza la fecha de cierre con %s', async (_caso, fecha) => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.cerrarAsignacion(superadmin(), {
        ...datosCierre,
        fechaFin: fecha,
      }),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.cerrarAsignacion).not.toHaveBeenCalled();
  });
});

describe('obtenerJornadaParaFecha', () => {
  it('devuelve el turno diurno en la primera posición del ciclo', async () => {
    const { servicio, espias } = crearEscenario();

    const resultado = await servicio.obtenerJornadaParaFecha(
      superadmin(),
      12,
      '2026-01-01',
    );

    expect(resultado).toEqual<JornadaDeFecha>({
      fecha: '2026-01-01',
      esDescanso: false,
      turno: TURNO_DIURNO,
      minutosLaborables: 450,
    });

    expect(espias.obtenerAsignacionParaFecha).toHaveBeenCalledWith(
      5,
      12,
      '2026-01-01',
    );
  });

  it('calcula la segunda posición del ciclo y devuelve el turno nocturno', async () => {
    const { servicio } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-02'),
    ).resolves.toEqual({
      fecha: '2026-01-02',
      esDescanso: false,
      turno: TURNO_NOCTURNO,
      minutosLaborables: 435,
    });
  });

  it('devuelve descanso sin turno ni minutos laborables', async () => {
    const { servicio } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-03'),
    ).resolves.toEqual({
      fecha: '2026-01-03',
      esDescanso: true,
      turno: null,
      minutosLaborables: 0,
    });
  });

  it('reinicia el ciclo después de completar sus posiciones', async () => {
    const { servicio } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-04'),
    ).resolves.toMatchObject({
      esDescanso: false,
      turno: TURNO_DIURNO,
      minutosLaborables: 450,
    });
  });

  it('calcula correctamente fechas anteriores a la referencia del ciclo', async () => {
    const { servicio, establecerAsignacion } = crearEscenario();
    establecerAsignacion({ ...ASIGNACION, fechaInicio: '2025-12-30' });

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2025-12-31'),
    ).resolves.toMatchObject({
      esDescanso: true,
      turno: null,
      minutosLaborables: 0,
    });
  });

  it('rechaza un empleado con identificador inválido', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 0, '2026-01-01'),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.obtenerAsignacionParaFecha).not.toHaveBeenCalled();
  });

  it.each([
    ['formato incorrecto', '01/01/2026'],
    ['día inexistente', '2026-02-30'],
    ['mes inexistente', '2026-13-01'],
  ])('rechaza la consulta con fecha de %s', async (_caso, fecha) => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.obtenerAsignacionParaFecha).not.toHaveBeenCalled();
  });

  it('rechaza consultar una fecha sin asignación', async () => {
    const { servicio, espias, establecerAsignacion } = crearEscenario();
    establecerAsignacion(null);

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-01'),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    expect(espias.obtenerPatron).not.toHaveBeenCalled();
  });

  it('no consulta asignaciones de otra empresa', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(6), 12, '2026-01-01'),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    expect(espias.obtenerAsignacionParaFecha).toHaveBeenCalledWith(
      6,
      12,
      '2026-01-01',
    );
  });

  it('rechaza una asignación cuyo patrón ya no existe', async () => {
    const { servicio, establecerPatron } = crearEscenario();
    establecerPatron(null);

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-01'),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('rechaza una posición del patrón sin turno asociado', async () => {
    const { servicio, establecerPatron } = crearEscenario();

    establecerPatron({
      ...PATRON,
      dias: [
        { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 999 },
        ...PATRON.dias.slice(1),
      ],
    });

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-01-01'),
    ).rejects.toThrow('El turno configurado en el patrón ya no existe');
  });
});







