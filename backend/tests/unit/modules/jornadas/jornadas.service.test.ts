// Pruebas del servicio de jornadas: validaciones de turnos y aislamiento por empresa.
import { describe, expect, it, vi } from 'vitest';
import { JornadasService } from '../../../../src/modules/jornadas/jornadas.service';
import type {
  AsignacionJornada,
  DatosActualizarTurno,
  DatosCerrarAsignacion,
  DatosNuevaAsignacion,
  DatosNuevoPatron,
  DatosNuevoTurno,
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

function superadmin(empresaId = 5): UsuarioAutenticado {
  return { id: 99, empresaId, rol: 'SUPERADMIN', jti: 'jti-99', expira: 9_999_999_999 };
}

function crearEscenario() {
  const turnos = new Map<number, TurnoJornada>([[1, { ...TURNO }]]);
  let siguienteId = 2;

  const obtenerTurno = vi.fn<IJornadasRepository['obtenerTurno']>(
    (empresaId, turnoId) => {
      const turno = turnos.get(turnoId);
      return Promise.resolve(
        turno && empresaId === 5 ? { ...turno } : null,
      );
    },
  );

  const listarTurnos = vi.fn<IJornadasRepository['listarTurnos']>(
    (empresaId, incluirInactivos = false) => {
      if (empresaId !== 5) return Promise.resolve([]);
      return Promise.resolve(
        [...turnos.values()]
          .filter((turno) => incluirInactivos || turno.activo)
          .map((turno) => ({ ...turno })),
      );
    },
  );

  const crearTurno = vi.fn<IJornadasRepository['crearTurno']>(
    (empresaId, _usuarioId, datos) => {
      const turno: TurnoJornada = {
        id: siguienteId++,
        ...datos,
        activo: true,
      };
      if (empresaId === 5) turnos.set(turno.id, turno);
      return Promise.resolve({ ...turno });
    },
  );

  const actualizarTurno = vi.fn<IJornadasRepository['actualizarTurno']>(
    (empresaId, _usuarioId, turnoId, datos) => {
      const anterior = turnos.get(turnoId);
      if (!anterior || empresaId !== 5) {
        return Promise.reject(new Error('El turno no existe'));
      }
      const actualizado: TurnoJornada = { id: turnoId, ...datos };
      turnos.set(turnoId, actualizado);
      return Promise.resolve({ ...actualizado });
    },
  );

  const obtenerPatron = vi.fn<IJornadasRepository['obtenerPatron']>(
    () => Promise.resolve(null),
  );
  const listarPatrones = vi.fn<IJornadasRepository['listarPatrones']>(
    () => Promise.resolve([]),
  );
  const crearPatron = vi.fn<IJornadasRepository['crearPatron']>(
    () => Promise.reject(
      new Error('Método de patrones no configurado en este escenario'),
    ),
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
    turnos,
    repositorio,
    espias: {
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
    },
    servicio: new JornadasService({ repositorio }),
  };
}
const NUEVO_TURNO: DatosNuevoTurno = {
  nombre: 'Turno nocturno',
  horaInicio: '22:00:00',
  horaFin: '06:00:00',
  minutosDescanso: 45,
};

describe('obtener y listar turnos', () => {
  it('obtiene un turno de la empresa autenticada', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.obtenerTurno(superadmin(), 1)).resolves.toEqual(TURNO);
  });

  it('rechaza un turno inexistente o de otra empresa', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.obtenerTurno(superadmin(), 999))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.obtenerTurno(superadmin(6), 1))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('lista los turnos activos por defecto', async () => {
    const { servicio, turnos } = crearEscenario();
    turnos.set(2, { ...TURNO, id: 2, nombre: 'Inactivo', activo: false });
    await expect(servicio.listarTurnos(superadmin())).resolves.toEqual([TURNO]);
  });

  it('permite incluir turnos inactivos', async () => {
    const { servicio, turnos } = crearEscenario();
    turnos.set(2, { ...TURNO, id: 2, nombre: 'Inactivo', activo: false });
    expect(await servicio.listarTurnos(superadmin(), true)).toHaveLength(2);
  });

  it('no mezcla turnos de otras empresas', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.listarTurnos(superadmin(6))).resolves.toEqual([]);
  });
});

describe('crear turnos', () => {
  it('crea un turno nocturno que termina al dia siguiente', async () => {
    const { servicio, espias } = crearEscenario();
    const creado = await servicio.crearTurno(superadmin(), NUEVO_TURNO);

    expect(creado).toMatchObject({ ...NUEVO_TURNO, id: 2, activo: true });
    expect(espias.crearTurno).toHaveBeenCalledWith(5, 99, NUEVO_TURNO);
  });

  it('elimina espacios sobrantes del nombre', async () => {
    const { servicio } = crearEscenario();
    const creado = await servicio.crearTurno(superadmin(), { ...NUEVO_TURNO, nombre: '  Nocturno  ' });
    expect(creado.nombre).toBe('Nocturno');
  });

  it.each([
    ['nombre vacio', { ...NUEVO_TURNO, nombre: '  ' }],
    ['nombre demasiado largo', { ...NUEVO_TURNO, nombre: 'T'.repeat(101) }],
    ['hora de inicio invalida', { ...NUEVO_TURNO, horaInicio: '25:00:00' }],
    ['hora de fin invalida', { ...NUEVO_TURNO, horaFin: '06:60:00' }],
    ['horas iguales', { ...NUEVO_TURNO, horaFin: '22:00:00' }],
    ['descanso negativo', { ...NUEVO_TURNO, minutosDescanso: -1 }],
    ['descanso decimal', { ...NUEVO_TURNO, minutosDescanso: 1.5 }],
    ['descanso igual a la duracion', { ...NUEVO_TURNO, horaInicio: '08:00:00', horaFin: '09:00:00', minutosDescanso: 60 }],
    ['descanso mayor a la duracion', { ...NUEVO_TURNO, horaInicio: '08:00:00', horaFin: '09:00:00', minutosDescanso: 61 }],
  ] as [string, DatosNuevoTurno][])('rechaza %s', async (_caso, datos) => {
    const { servicio, espias } = crearEscenario();
    await expect(servicio.crearTurno(superadmin(), datos))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(espias.crearTurno).not.toHaveBeenCalled();
  });
});

describe('actualizar turnos', () => {
  const actualizacion: DatosActualizarTurno = {
    nombre: 'Turno actualizado',
    horaInicio: '07:00:00',
    horaFin: '15:00:00',
    minutosDescanso: 30,
    activo: true,
  };

  it('actualiza un turno existente', async () => {
    const { servicio, espias } = crearEscenario();
    const actualizado = await servicio.actualizarTurno(superadmin(), 1, actualizacion);

    expect(actualizado).toEqual({ id: 1, ...actualizacion });
    expect(espias.actualizarTurno).toHaveBeenCalledWith(5, 99, 1, actualizacion);
  });

  it('rechaza actualizar un turno inexistente o de otra empresa', async () => {
    const { servicio, espias } = crearEscenario();
    await expect(servicio.actualizarTurno(superadmin(), 999, actualizacion))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.actualizarTurno(superadmin(6), 1, actualizacion))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(espias.actualizarTurno).not.toHaveBeenCalled();
  });

  it('rechaza un estado activo que no sea booleano', async () => {
    const { servicio, espias } = crearEscenario();
    const datos = { ...actualizacion, activo: 'si' } as unknown as DatosActualizarTurno;

    await expect(servicio.actualizarTurno(superadmin(), 1, datos))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(espias.actualizarTurno).not.toHaveBeenCalled();
  });

  it('valida los datos antes de actualizar', async () => {
    const { servicio, espias } = crearEscenario();
    await expect(servicio.actualizarTurno(superadmin(), 1, {
      ...actualizacion,
      minutosDescanso: 500,
    })).rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(espias.actualizarTurno).not.toHaveBeenCalled();
  });
});


const NUEVO_PATRON: DatosNuevoPatron = {
  nombre: 'Ciclo rotativo',
  descripcion: 'Dos días de ciclo',
  cicloDias: 2,
  dias: [
    { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

const PATRON: PatronJornada = {
  id: 10,
  nombre: 'Ciclo rotativo',
  descripcion: 'Dos días de ciclo',
  cicloDias: 2,
  activo: true,
  dias: [
    { id: 1, diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { id: 2, diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

describe('gestión de patrones', () => {
  it('obtiene un patrón de la empresa autenticada', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerPatron).mockResolvedValue(PATRON);

    await expect(servicio.obtenerPatron(superadmin(), 10)).resolves.toEqual(PATRON);
    expect(espias.obtenerPatron).toHaveBeenCalledWith(5, 10);
  });

  it('rechaza un patrón inexistente', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerPatron).mockResolvedValue(null);

    await expect(servicio.obtenerPatron(superadmin(), 10))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('lista patrones excluyendo inactivos por defecto', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.listarPatrones).mockResolvedValue([PATRON]);

    await expect(servicio.listarPatrones(superadmin())).resolves.toEqual([PATRON]);
    expect(espias.listarPatrones).toHaveBeenCalledWith(5, false);
  });

  it('permite incluir patrones inactivos', async () => {
    const { servicio, espias } = crearEscenario();
    const inactivo = { ...PATRON, id: 11, activo: false };
    vi.mocked(espias.listarPatrones).mockResolvedValue([PATRON, inactivo]);

    await expect(servicio.listarPatrones(superadmin(), true))
      .resolves.toEqual([PATRON, inactivo]);
    expect(espias.listarPatrones).toHaveBeenCalledWith(5, true);
  });

  it('crea un patrón y ordena los días del ciclo', async () => {
    const { servicio, espias } = crearEscenario();
    const datos = {
      ...NUEVO_PATRON,
      dias: [...NUEVO_PATRON.dias].reverse(),
    };
    vi.mocked(espias.crearPatron).mockResolvedValue(PATRON);

    await expect(servicio.crearPatron(superadmin(), datos)).resolves.toEqual(PATRON);

    expect(espias.obtenerTurno).toHaveBeenCalledOnce();
    expect(espias.crearPatron).toHaveBeenCalledWith(5, 99, {
      ...datos,
      dias: NUEVO_PATRON.dias,
    });
  });

  it.each([
    ['nombre vacío', { ...NUEVO_PATRON, nombre: '  ' }],
    ['nombre demasiado largo', { ...NUEVO_PATRON, nombre: 'P'.repeat(101) }],
    ['descripción demasiado larga', { ...NUEVO_PATRON, descripcion: 'D'.repeat(501) }],
    ['descripción de tipo incorrecto', { ...NUEVO_PATRON, descripcion: 123 }],
    ['ciclo menor que uno', { ...NUEVO_PATRON, cicloDias: 0 }],
    ['ciclo mayor que 366', { ...NUEVO_PATRON, cicloDias: 367 }],
    ['ciclo decimal', { ...NUEVO_PATRON, cicloDias: 1.5 }],
    ['cantidad de días diferente al ciclo', { ...NUEVO_PATRON, dias: [NUEVO_PATRON.dias[0]] }],
    ['día fuera del ciclo', { ...NUEVO_PATRON, dias: [
      { diaCiclo: 3, tipoDia: 'TURNO', turnoId: 1 },
      NUEVO_PATRON.dias[1],
    ] }],
    ['posición duplicada', { ...NUEVO_PATRON, dias: [
      NUEVO_PATRON.dias[0],
      { diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null },
    ] }],
    ['turno con identificador cero', { ...NUEVO_PATRON, dias: [
      { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 0 },
      NUEVO_PATRON.dias[1],
    ] }],
    ['turno sin identificador', { ...NUEVO_PATRON, dias: [
      { diaCiclo: 1, tipoDia: 'TURNO', turnoId: null },
      NUEVO_PATRON.dias[1],
    ] }],
    ['descanso con turno asociado', { ...NUEVO_PATRON, dias: [
      NUEVO_PATRON.dias[0],
      { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: 1 },
    ] }],
    ['tipo de día inválido', { ...NUEVO_PATRON, dias: [
      { diaCiclo: 1, tipoDia: 'FERIADO', turnoId: null },
      NUEVO_PATRON.dias[1],
    ] }],
  ] as [string, unknown][])('rechaza un patrón con %s', async (_caso, datos) => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.crearPatron(superadmin(), datos as DatosNuevoPatron),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('rechaza un patrón cuyo turno no existe en el hospital', async () => {
    const { servicio, espias } = crearEscenario();
    const datos = {
      ...NUEVO_PATRON,
      dias: [
        { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 999 },
        NUEVO_PATRON.dias[1],
      ],
    } as DatosNuevoPatron;

    await expect(servicio.crearPatron(superadmin(), datos))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('rechaza un patrón que utiliza un turno inactivo', async () => {
    const { servicio, turnos, espias } = crearEscenario();
    turnos.set(1, { ...TURNO, activo: false });

    await expect(servicio.crearPatron(superadmin(), NUEVO_PATRON))
      .rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.crearPatron).not.toHaveBeenCalled();
  });

  it('consulta cada turno único una sola vez', async () => {
    const { servicio, espias } = crearEscenario();
    const datos: DatosNuevoPatron = {
      ...NUEVO_PATRON,
      cicloDias: 3,
      dias: [
        { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
        { diaCiclo: 2, tipoDia: 'TURNO', turnoId: 1 },
        { diaCiclo: 3, tipoDia: 'DESCANSO', turnoId: null },
      ],
    };
    vi.mocked(espias.crearPatron).mockResolvedValue(PATRON);

    await servicio.crearPatron(superadmin(), datos);

    expect(espias.obtenerTurno).toHaveBeenCalledOnce();
    expect(espias.crearPatron).toHaveBeenCalledOnce();
  });
});

const ASIGNACION: AsignacionJornada = {
  id: 25,
  usuarioId: 12,
  patronId: 10,
  fechaInicio: '2026-11-01',
  fechaFin: null,
  fechaReferencia: '2026-11-01',
  configuradoPorId: 99,
};

const NUEVA_ASIGNACION: DatosNuevaAsignacion = {
  usuarioId: 12,
  patronId: 10,
  fechaInicio: '2026-11-01',
  fechaReferencia: '2026-11-01',
};

const CIERRE_ASIGNACION: DatosCerrarAsignacion = {
  asignacionId: 25,
  fechaFin: '2026-11-15',
};

describe('gestión de asignaciones', () => {
  describe('crearAsignacion', () => {
    it('crea una asignación con un patrón activo', async () => {
      const { servicio, espias } = crearEscenario();
      vi.mocked(espias.obtenerPatron).mockResolvedValue(PATRON);
      vi.mocked(espias.crearAsignacion).mockResolvedValue(ASIGNACION);

      await expect(
        servicio.crearAsignacion(superadmin(), NUEVA_ASIGNACION),
      ).resolves.toEqual(ASIGNACION);

      expect(espias.obtenerPatron).toHaveBeenCalledWith(5, 10);
      expect(espias.crearAsignacion).toHaveBeenCalledWith(
        5,
        99,
        NUEVA_ASIGNACION,
      );
    });

    it('rechaza un identificador de empleado inválido', async () => {
      const { servicio, espias } = crearEscenario();

      await expect(
        servicio.crearAsignacion(superadmin(), {
          ...NUEVA_ASIGNACION,
          usuarioId: 0,
        }),
      ).rejects.toMatchObject({ codigo: 'VALIDACION' });

      expect(espias.obtenerPatron).not.toHaveBeenCalled();
      expect(espias.crearAsignacion).not.toHaveBeenCalled();
    });

    it('rechaza un identificador de patrón inválido', async () => {
      const { servicio, espias } = crearEscenario();

      await expect(
        servicio.crearAsignacion(superadmin(), {
          ...NUEVA_ASIGNACION,
          patronId: 0,
        }),
      ).rejects.toMatchObject({ codigo: 'VALIDACION' });

      expect(espias.obtenerPatron).not.toHaveBeenCalled();
      expect(espias.crearAsignacion).not.toHaveBeenCalled();
    });

    it.each([
      ['fecha de inicio con formato incorrecto', '01-11-2026', '2026-11-01'],
      ['fecha de inicio inexistente', '2026-02-30', '2026-11-01'],
      ['fecha de referencia con formato incorrecto', '2026-11-01', '20261101'],
      ['fecha de referencia inexistente', '2026-11-01', '2026-02-30'],
    ])('rechaza una %s', async (_caso, fechaInicio, fechaReferencia) => {
      const { servicio, espias } = crearEscenario();

      await expect(
        servicio.crearAsignacion(superadmin(), {
          ...NUEVA_ASIGNACION,
          fechaInicio,
          fechaReferencia,
        }),
      ).rejects.toMatchObject({ codigo: 'VALIDACION' });

      expect(espias.obtenerPatron).not.toHaveBeenCalled();
      expect(espias.crearAsignacion).not.toHaveBeenCalled();
    });

    it('rechaza asignar un patrón inactivo', async () => {
      const { servicio, espias } = crearEscenario();
      vi.mocked(espias.obtenerPatron).mockResolvedValue({
        ...PATRON,
        activo: false,
      });

      await expect(
        servicio.crearAsignacion(superadmin(), NUEVA_ASIGNACION),
      ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });

      expect(espias.crearAsignacion).not.toHaveBeenCalled();
    });
  });

  describe('cerrarAsignacion', () => {
    it('cierra una asignación y conserva el resultado del repositorio', async () => {
      const { servicio, espias } = crearEscenario();
      const cerrada = {
        ...ASIGNACION,
        fechaFin: CIERRE_ASIGNACION.fechaFin,
      };
      vi.mocked(espias.cerrarAsignacion).mockResolvedValue(cerrada);

      await expect(
        servicio.cerrarAsignacion(superadmin(), CIERRE_ASIGNACION),
      ).resolves.toEqual(cerrada);

      expect(espias.cerrarAsignacion).toHaveBeenCalledWith(
        5,
        99,
        CIERRE_ASIGNACION,
      );
    });

    it.each([0, -1, 1.5, Number.NaN])(
      'rechaza el identificador de asignación %s',
      async (asignacionId) => {
        const { servicio, espias } = crearEscenario();

        await expect(
          servicio.cerrarAsignacion(superadmin(), {
            ...CIERRE_ASIGNACION,
            asignacionId,
          }),
        ).rejects.toMatchObject({ codigo: 'VALIDACION' });

        expect(espias.cerrarAsignacion).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['formato incorrecto', '15-11-2026'],
      ['fecha inexistente', '2026-02-30'],
      ['fecha vacía', ''],
    ])('rechaza una fecha de cierre con %s', async (_caso, fechaFin) => {
      const { servicio, espias } = crearEscenario();

      await expect(
        servicio.cerrarAsignacion(superadmin(), {
          ...CIERRE_ASIGNACION,
          fechaFin,
        }),
      ).rejects.toMatchObject({ codigo: 'VALIDACION' });

      expect(espias.cerrarAsignacion).not.toHaveBeenCalled();
    });
  });
describe('obtenerJornadaParaFecha', () => {
  const fecha = '2026-11-02';
  const asignacion: AsignacionJornada = {
    ...ASIGNACION,
    fechaReferencia: '2026-11-01',
  };

  it('calcula un día de descanso del ciclo', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue(asignacion);
    vi.mocked(espias.obtenerPatron).mockResolvedValue(PATRON);

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).resolves.toEqual({
      fecha,
      esDescanso: true,
      turno: null,
      minutosLaborables: 0,
    });

    expect(espias.obtenerAsignacionParaFecha).toHaveBeenCalledWith(5, 12, fecha);
    expect(espias.obtenerTurno).not.toHaveBeenCalled();
  });

  it('calcula las horas laborables de un turno', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue({
      ...asignacion,
      fechaReferencia: '2026-11-02',
    });
    vi.mocked(espias.obtenerPatron).mockResolvedValue(PATRON);

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-11-02'),
    ).resolves.toEqual({
      fecha: '2026-11-02',
      esDescanso: false,
      turno: TURNO,
      minutosLaborables: 450,
    });

    expect(espias.obtenerTurno).toHaveBeenCalledWith(5, 1);
  });

  it('calcula correctamente una posición anterior a la fecha de referencia', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue(asignacion);
    vi.mocked(espias.obtenerPatron).mockResolvedValue(PATRON);

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, '2026-10-31'),
    ).resolves.toMatchObject({
      fecha: '2026-10-31',
      esDescanso: true,
      turno: null,
      minutosLaborables: 0,
    });
  });

  it('rechaza un identificador de empleado inválido', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 0, fecha),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.obtenerAsignacionParaFecha).not.toHaveBeenCalled();
  });

  it.each([
    '2026-02-30',
    '2026-13-01',
    '01-11-2026',
    '',
  ])('rechaza la fecha inválida %s', async (fechaInvalida) => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fechaInvalida),
    ).rejects.toMatchObject({ codigo: 'VALIDACION' });

    expect(espias.obtenerAsignacionParaFecha).not.toHaveBeenCalled();
  });

  it('rechaza un empleado sin asignación vigente', async () => {
    const { servicio, espias } = crearEscenario();

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    expect(espias.obtenerPatron).not.toHaveBeenCalled();
  });

  it('rechaza un patrón que no contiene la posición calculada', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue(asignacion);
    vi.mocked(espias.obtenerPatron).mockResolvedValue({
      ...PATRON,
      dias: [PATRON.dias[0]!],
    });

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza una posición TURNO sin turno asociado', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue({
      ...asignacion,
      fechaReferencia: fecha,
    });
    vi.mocked(espias.obtenerPatron).mockResolvedValue({
      ...PATRON,
      dias: [{
        id: 1,
        diaCiclo: 1,
        tipoDia: 'TURNO',
        turnoId: null,
      }],
    });

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza un turno que ya no existe', async () => {
    const { servicio, espias } = crearEscenario();
    vi.mocked(espias.obtenerAsignacionParaFecha).mockResolvedValue({
      ...asignacion,
      fechaReferencia: fecha,
    });
    vi.mocked(espias.obtenerPatron).mockResolvedValue({
      ...PATRON,
      dias: [{
        id: 1,
        diaCiclo: 1,
        tipoDia: 'TURNO',
        turnoId: 999,
      }],
    });

    await expect(
      servicio.obtenerJornadaParaFecha(superadmin(), 12, fecha),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });
});

});
