// Pruebas unitarias de los esquemas de validación de jornadas.

import { describe, expect, it } from 'vitest';
import {
  esquemaCrearTurno,
  esquemaActualizarTurno,
  esquemaCrearPatron,
  esquemaActualizarPatron,
  esquemaCrearAsignacion,
  esquemaCerrarAsignacion,
  esquemaIdJornada,
  esquemaListarJornadas,
  esquemaConsultarJornada,
} from '../../../../src/modules/jornadas/jornadas.validators';

const TURNO = {
  nombre: 'Turno diurno',
  horaInicio: '08:00:00',
  horaFin: '16:00:00',
  minutosDescanso: 30,
};

const PATRON = {
  nombre: 'Ciclo rotativo',
  descripcion: 'Ciclo de dos días',
  cicloDias: 2,
  dias: [
    { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 1 },
    { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: null },
  ],
};

describe('esquemaCrearTurno', () => {
  it('acepta un turno válido', () => {
    expect(esquemaCrearTurno.safeParse(TURNO).success).toBe(true);
  });

  it('acepta un turno nocturno que termina al día siguiente', () => {
    expect(esquemaCrearTurno.safeParse({
      ...TURNO,
      horaInicio: '22:00:00',
      horaFin: '06:00:00',
    }).success).toBe(true);
  });

  it.each([
    ['nombre demasiado corto', { ...TURNO, nombre: 'A' }],
    ['nombre vacío', { ...TURNO, nombre: '  ' }],
    ['nombre demasiado largo', { ...TURNO, nombre: 'T'.repeat(101) }],
    ['hora inicial inválida', { ...TURNO, horaInicio: '25:00:00' }],
    ['hora final inválida', { ...TURNO, horaFin: '12:60:00' }],
    ['hora sin segundos', { ...TURNO, horaInicio: '08:00' }],
    ['horas iguales', { ...TURNO, horaFin: TURNO.horaInicio }],
    ['descanso negativo', { ...TURNO, minutosDescanso: -1 }],
    ['descanso decimal', { ...TURNO, minutosDescanso: 1.5 }],
    ['descanso igual a duración', {
      ...TURNO,
      horaInicio: '08:00:00',
      horaFin: '09:00:00',
      minutosDescanso: 60,
    }],
    ['descanso mayor a duración', {
      ...TURNO,
      horaInicio: '08:00:00',
      horaFin: '09:00:00',
      minutosDescanso: 61,
    }],
    ['propiedad adicional', { ...TURNO, empresaId: 5 }],
  ])('rechaza %s', (_caso, datos) => {
    expect(esquemaCrearTurno.safeParse(datos).success).toBe(false);
  });

  it('recorta espacios del nombre', () => {
    expect(esquemaCrearTurno.parse({ ...TURNO, nombre: '  Turno  ' }).nombre)
      .toBe('Turno');
  });
});

describe('esquemaActualizarTurno', () => {
  it('acepta un turno válido con estado', () => {
    expect(esquemaActualizarTurno.safeParse({
      ...TURNO,
      activo: true,
    }).success).toBe(true);
  });

  it('rechaza un estado que no sea booleano', () => {
    expect(esquemaActualizarTurno.safeParse({
      ...TURNO,
      activo: 'true',
    }).success).toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(esquemaActualizarTurno.safeParse({
      ...TURNO,
      activo: true,
      usuarioId: 1,
    }).success).toBe(false);
  });

  it('rechaza descanso igual o mayor a la duración', () => {
    expect(esquemaActualizarTurno.safeParse({
      ...TURNO,
      horaInicio: '08:00:00',
      horaFin: '09:00:00',
      minutosDescanso: 60,
      activo: true,
    }).success).toBe(false);
  });
});

describe('esquemaCrearPatron', () => {
  it('acepta un patrón válido', () => {
    expect(esquemaCrearPatron.safeParse(PATRON).success).toBe(true);
  });

  it('acepta descripción nula', () => {
    expect(esquemaCrearPatron.safeParse({
      ...PATRON,
      descripcion: null,
    }).success).toBe(true);
  });

  it('acepta los límites del ciclo', () => {
    const dias = Array.from({ length: 366 }, (_, indice) => ({
      diaCiclo: indice + 1,
      tipoDia: 'DESCANSO' as const,
      turnoId: null,
    }));

    expect(esquemaCrearPatron.safeParse({
      ...PATRON,
      cicloDias: 366,
      dias,
    }).success).toBe(true);
  });

  it.each([
    ['nombre vacío', { ...PATRON, nombre: ' ' }],
    ['nombre largo', { ...PATRON, nombre: 'P'.repeat(101) }],
    ['descripción larga', { ...PATRON, descripcion: 'D'.repeat(501) }],
    ['descripción de tipo incorrecto', { ...PATRON, descripcion: 123 }],
    ['ciclo menor que uno', { ...PATRON, cicloDias: 0 }],
    ['ciclo mayor que 366', { ...PATRON, cicloDias: 367 }],
    ['ciclo decimal', { ...PATRON, cicloDias: 1.5 }],
    ['cantidad de días incorrecta', { ...PATRON, dias: [PATRON.dias[0]] }],
    ['posición fuera del ciclo', {
      ...PATRON,
      dias: [
        { diaCiclo: 3, tipoDia: 'TURNO', turnoId: 1 },
        PATRON.dias[1],
      ],
    }],
    ['posiciones duplicadas', {
      ...PATRON,
      dias: [
        PATRON.dias[0],
        { diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null },
      ],
    }],
    ['día con posición cero', {
      ...PATRON,
      dias: [
        { diaCiclo: 0, tipoDia: 'TURNO', turnoId: 1 },
        PATRON.dias[1],
      ],
    }],
    ['turno sin identificador', {
      ...PATRON,
      dias: [
        { diaCiclo: 1, tipoDia: 'TURNO', turnoId: null },
        PATRON.dias[1],
      ],
    }],
    ['turno con identificador cero', {
      ...PATRON,
      dias: [
        { diaCiclo: 1, tipoDia: 'TURNO', turnoId: 0 },
        PATRON.dias[1],
      ],
    }],
    ['descanso con turno asociado', {
      ...PATRON,
      dias: [
        PATRON.dias[0],
        { diaCiclo: 2, tipoDia: 'DESCANSO', turnoId: 1 },
      ],
    }],
    ['tipo de día inválido', {
      ...PATRON,
      dias: [
        { diaCiclo: 1, tipoDia: 'FERIADO', turnoId: null },
        PATRON.dias[1],
      ],
    }],
    ['propiedad adicional', { ...PATRON, empresaId: 5 }],
  ])('rechaza %s', (_caso, datos) => {
    expect(esquemaCrearPatron.safeParse(datos).success).toBe(false);
  });
});

describe('esquemaActualizarPatron', () => {
  it('acepta un patrón válido con estado', () => {
    expect(esquemaActualizarPatron.safeParse({
      ...PATRON,
      activo: false,
    }).success).toBe(true);
  });

  it('rechaza estado no booleano', () => {
    expect(esquemaActualizarPatron.safeParse({
      ...PATRON,
      activo: 'false',
    }).success).toBe(false);
  });

  it('rechaza un ciclo incompleto', () => {
    expect(esquemaActualizarPatron.safeParse({
      ...PATRON,
      dias: [PATRON.dias[0]],
      activo: true,
    }).success).toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(esquemaActualizarPatron.safeParse({
      ...PATRON,
      activo: true,
      hospitalId: 5,
    }).success).toBe(false);
  });
});

describe('esquemaCrearAsignacion', () => {
  const asignacion = {
    usuarioId: 12,
    patronId: 10,
    fechaInicio: '2026-11-01',
    fechaReferencia: '2026-11-01',
  };

  it('acepta una asignación válida', () => {
    expect(esquemaCrearAsignacion.safeParse(asignacion).success).toBe(true);
  });

  it.each([
    ['usuario cero', { ...asignacion, usuarioId: 0 }],
    ['usuario decimal', { ...asignacion, usuarioId: 1.5 }],
    ['patrón negativo', { ...asignacion, patronId: -1 }],
    ['fecha inicial inválida', { ...asignacion, fechaInicio: '2026-02-30' }],
    ['fecha de referencia inválida', { ...asignacion, fechaReferencia: '01-11-2026' }],
    ['propiedad adicional', { ...asignacion, empresaId: 5 }],
  ])('rechaza %s', (_caso, datos) => {
    expect(esquemaCrearAsignacion.safeParse(datos).success).toBe(false);
  });
});

describe('esquemaCerrarAsignacion', () => {
  it('acepta un cierre válido', () => {
    expect(esquemaCerrarAsignacion.safeParse({
      asignacionId: 25,
      fechaFin: '2026-11-15',
    }).success).toBe(true);
  });

  it.each([
    ['identificador cero', { asignacionId: 0, fechaFin: '2026-11-15' }],
    ['identificador decimal', { asignacionId: 1.5, fechaFin: '2026-11-15' }],
    ['fecha inexistente', { asignacionId: 25, fechaFin: '2026-02-30' }],
    ['fecha vacía', { asignacionId: 25, fechaFin: '' }],
    ['propiedad adicional', { asignacionId: 25, fechaFin: '2026-11-15', usuarioId: 1 }],
  ])('rechaza %s', (_caso, datos) => {
    expect(esquemaCerrarAsignacion.safeParse(datos).success).toBe(false);
  });
});

describe('esquemaIdJornada', () => {
  it('convierte un identificador textual válido', () => {
    expect(esquemaIdJornada.parse({ id: '25' })).toEqual({ id: 25 });
  });

  it.each([
    ['cero', '0'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['texto', 'abc'],
    ['ausente', undefined],
  ])('rechaza identificador %s', (_caso, id) => {
    expect(esquemaIdJornada.safeParse({ id }).success).toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(esquemaIdJornada.safeParse({ id: '1', usuarioId: 2 }).success).toBe(false);
  });
});

describe('esquemaListarJornadas', () => {
  it('transforma true textual a booleano true', () => {
    expect(esquemaListarJornadas.parse({ incluirInactivos: 'true' }))
      .toEqual({ incluirInactivos: true });
  });

  it('transforma false textual a booleano false', () => {
    expect(esquemaListarJornadas.parse({ incluirInactivos: 'false' }))
      .toEqual({ incluirInactivos: false });
  });

  it('acepta el parámetro omitido', () => {
    expect(esquemaListarJornadas.parse({ })).toEqual({ incluirInactivos: false });
  });

  it('rechaza valores diferentes de true y false', () => {
    expect(esquemaListarJornadas.safeParse({ incluirInactivos: '1' }).success)
      .toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(esquemaListarJornadas.safeParse({ otro: 'valor' }).success).toBe(false);
  });
});

describe('esquemaConsultarJornada', () => {
  it('convierte usuarioId textual y acepta fecha válida', () => {
    expect(esquemaConsultarJornada.parse({
      usuarioId: '12',
      fecha: '2026-11-04',
    })).toEqual({
      usuarioId: 12,
      fecha: '2026-11-04',
    });
  });

  it.each([
    ['usuario cero', '0', '2026-11-04'],
    ['usuario decimal', '1.5', '2026-11-04'],
    ['usuario no numérico', 'abc', '2026-11-04'],
    ['fecha inexistente', '12', '2026-02-30'],
    ['fecha con formato incorrecto', '12', '04-11-2026'],
  ])('rechaza %s', (_caso, usuarioId, fecha) => {
    expect(esquemaConsultarJornada.safeParse({ usuarioId, fecha }).success)
      .toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(esquemaConsultarJornada.safeParse({
      usuarioId: '12',
      fecha: '2026-11-04',
      empresaId: 5,
    }).success).toBe(false);
  });
});