// Pruebas del servicio de periodos con configuración individual, por área e institucional.
import { describe, expect, it } from 'vitest';
import { PeriodosService } from '../../../../src/modules/vacaciones/vacaciones.periodos.service';
import { crearPeriodosEnMemoria } from '../../../helpers/periodos';

const HOY = '2026-10-15';

function crearEscenario(diasVacacionesAnuales = 30) {
  const memoria = crearPeriodosEnMemoria();

  memoria.personas.set(1, {
    empresaId: 5,
    fechaIngreso: '2022-01-10',
    diasVacacionesPersona: null,
    diasVacacionesArea: null,
  });

  let consultasConfiguracion = 0;

  const servicio = new PeriodosService({
    repositorio: memoria.repositorio,
    obtenerDiasVacacionesAnuales: () => {
      consultasConfiguracion += 1;
      return Promise.resolve(diasVacacionesAnuales);
    },
  });

  return {
    ...memoria,
    servicio,
    obtenerConsultasConfiguracion: () => consultasConfiguracion,
  };
}

describe('asegurar', () => {
  it('utiliza los días institucionales cuando no hay excepciones', async () => {
    const { servicio, periodos } = crearEscenario(30);

    await servicio.asegurar(5, 1, HOY);

    expect(periodos).toHaveLength(2);
    expect(periodos.map((periodo) => periodo.diasDerecho)).toEqual([30, 30]);
  });

  it('prioriza los días configurados para el área sobre los institucionales', async () => {
    const { servicio, periodos, personas, obtenerConsultasConfiguracion } = crearEscenario(30);

    const persona = personas.get(1);
    if (persona) {
      persona.diasVacacionesArea = 35;
    }

    await servicio.asegurar(5, 1, HOY);

    expect(periodos.map((periodo) => periodo.diasDerecho)).toEqual([35, 35]);
    expect(obtenerConsultasConfiguracion()).toBe(0);
  });

  it('prioriza los días individuales del empleado sobre los del área', async () => {
    const { servicio, periodos, personas, obtenerConsultasConfiguracion } = crearEscenario(30);

    const persona = personas.get(1);
    if (persona) {
      persona.diasVacacionesArea = 35;
      persona.diasVacacionesPersona = 40;
    }

    await servicio.asegurar(5, 1, HOY);

    expect(periodos.map((periodo) => periodo.diasDerecho)).toEqual([40, 40]);
    expect(obtenerConsultasConfiguracion()).toBe(0);
  });

  it('utiliza los días del área cuando no existe una excepción individual', async () => {
    const { servicio, periodos, personas } = crearEscenario(30);

    const persona = personas.get(1);
    if (persona) {
      persona.diasVacacionesArea = 25;
    }

    await servicio.asegurar(5, 1, HOY);

    expect(periodos.map((periodo) => periodo.diasDerecho)).toEqual([25, 25]);
  });

  it('no modifica los días de derecho de los periodos que ya existen', async () => {
    const { servicio, periodos, personas } = crearEscenario();

    periodos.push({
      empresaId: 5,
      usuarioId: 1,
      fechaInicio: '2025-01-10',
      fechaCaducidad: '2027-01-10',
      diasDerecho: 20,
    });

    const persona = personas.get(1);
    if (persona) {
      persona.diasVacacionesArea = 35;
    }

    await servicio.asegurar(5, 1, HOY);

    expect(periodos).toHaveLength(2);
    expect(
      periodos.find((periodo) => periodo.fechaInicio === '2025-01-10')?.diasDerecho,
    ).toBe(20);
    expect(
      periodos.find((periodo) => periodo.fechaInicio === '2026-01-10')?.diasDerecho,
    ).toBe(35);
  });

  it('se puede llamar varias veces sin duplicar periodos', async () => {
    const { servicio, periodos } = crearEscenario();

    await servicio.asegurar(5, 1, HOY);
    await servicio.asegurar(5, 1, HOY);

    expect(periodos).toHaveLength(2);
  });

  it('no crea periodos si la fecha de ingreso es futura', async () => {
    const { servicio, periodos, personas, obtenerConsultasConfiguracion } = crearEscenario();

    const persona = personas.get(1);
    if (persona) {
      persona.fechaIngreso = '2026-10-16';
    }

    await servicio.asegurar(5, 1, HOY);

    expect(periodos).toHaveLength(0);
    expect(obtenerConsultasConfiguracion()).toBe(0);
  });

  it('no hace nada si la persona no existe en el hospital', async () => {
    const { servicio, periodos, obtenerConsultasConfiguracion } = crearEscenario();

    await servicio.asegurar(6, 1, HOY);

    expect(periodos).toHaveLength(0);
    expect(obtenerConsultasConfiguracion()).toBe(0);
  });

  it('no consulta la configuración institucional si no hay periodos que crear', async () => {
    const { servicio, periodos, obtenerConsultasConfiguracion } = crearEscenario();

    // Simula los periodos que ya existen para la fecha de cálculo.
    periodos.push(
      {
        empresaId: 5,
        usuarioId: 1,
        fechaInicio: '2022-01-10',
        fechaCaducidad: '2024-01-10',
        diasDerecho: 30,
      },
      {
        empresaId: 5,
        usuarioId: 1,
        fechaInicio: '2023-01-10',
        fechaCaducidad: '2025-01-10',
        diasDerecho: 30,
      },
    );

    await servicio.asegurar(5, 1, '2024-01-09');

    expect(periodos).toHaveLength(2);
    expect(obtenerConsultasConfiguracion()).toBe(0);
  });
});