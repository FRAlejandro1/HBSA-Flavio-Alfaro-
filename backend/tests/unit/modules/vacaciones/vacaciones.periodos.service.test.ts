// Pruebas del service de periodos y de la configuracion de dias, con el repositorio en memoria.
import { describe, expect, it } from 'vitest';
import { PeriodosService } from '../../../../src/modules/vacaciones/vacaciones.periodos.service';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import { crearPeriodosEnMemoria } from '../../../helpers/periodos';

const HOY = '2026-10-15';

function superadmin(empresaId = 5): UsuarioAutenticado {
  return { id: 99, empresaId, rol: 'SUPERADMIN', jti: 'jti-99', expira: 9_999_999_999 };
}

// Escenario: area 10 (raiz) con la subarea 11; la persona 1 trabaja en la 11 y entro el 10 de enero de 2022.
// El area 20 es de otro hospital.
function crearEscenario(diasPorDefecto = 30) {
  const memoria = crearPeriodosEnMemoria();
  memoria.areas.set(10, { empresaId: 5, parentId: null, diasVacaciones: null });
  memoria.areas.set(11, { empresaId: 5, parentId: 10, diasVacaciones: null });
  memoria.areas.set(20, { empresaId: 6, parentId: null, diasVacaciones: null });
  memoria.personas.set(1, { empresaId: 5, areaId: 11, fechaIngreso: '2022-01-10', diasVacaciones: null });
  const servicio = new PeriodosService({ repositorio: memoria.repositorio, diasPorDefecto });
  return { ...memoria, servicio };
}

describe('asegurar', () => {
  it('crea los periodos que empezaron y no han caducado, con los dias por defecto', async () => {
    const { servicio, periodos } = crearEscenario();
    await servicio.asegurar(5, 1, HOY);
    expect(periodos).toEqual([
      { empresaId: 5, usuarioId: 1, fechaInicio: '2025-01-10', fechaCaducidad: '2027-01-10', diasDerecho: 30 },
      { empresaId: 5, usuarioId: 1, fechaInicio: '2026-01-10', fechaCaducidad: '2028-01-10', diasDerecho: 30 },
    ]);
  });

  it('se puede llamar varias veces: no repite periodos', async () => {
    const { servicio, periodos } = crearEscenario();
    await servicio.asegurar(5, 1, HOY);
    await servicio.asegurar(5, 1, HOY);
    expect(periodos).toHaveLength(2);
  });

  it('no toca un periodo que ya existe', async () => {
    const { servicio, periodos } = crearEscenario();
    periodos.push({
      empresaId: 5,
      usuarioId: 1,
      fechaInicio: '2025-01-10',
      fechaCaducidad: '2027-01-10',
      diasDerecho: 20,
    });
    await servicio.asegurar(5, 1, HOY);
    expect(periodos).toHaveLength(2);
    expect(periodos.find((p) => p.fechaInicio === '2025-01-10')?.diasDerecho).toBe(20);
  });

  it('los dias de la persona mandan sobre los de su area', async () => {
    const { servicio, periodos, personas, areas } = crearEscenario();
    const persona = personas.get(1);
    const area = areas.get(11);
    if (persona) persona.diasVacaciones = 28;
    if (area) area.diasVacaciones = 35;
    await servicio.asegurar(5, 1, HOY);
    expect(periodos.map((p) => p.diasDerecho)).toEqual([28, 28]);
  });

  it('si la persona no tiene, rigen los de su area y, si el area no tiene, los del area padre', async () => {
    const { servicio, periodos, areas } = crearEscenario();
    const padre = areas.get(10);
    if (padre) padre.diasVacaciones = 40;
    await servicio.asegurar(5, 1, HOY);
    expect(periodos.map((p) => p.diasDerecho)).toEqual([40, 40]);

    periodos.length = 0;
    const propia = areas.get(11);
    if (propia) propia.diasVacaciones = 35;
    await servicio.asegurar(5, 1, HOY);
    expect(periodos.map((p) => p.diasDerecho)).toEqual([35, 35]);
  });

  it('una persona que ingresa en el futuro no recibe periodos', async () => {
    const { servicio, periodos, personas } = crearEscenario();
    const persona = personas.get(1);
    if (persona) persona.fechaIngreso = '2026-10-16';
    await servicio.asegurar(5, 1, HOY);
    expect(periodos).toHaveLength(0);
  });

  it('si la persona no existe en ese hospital no hace nada', async () => {
    const { servicio, periodos } = crearEscenario();
    await servicio.asegurar(6, 1, HOY);
    expect(periodos).toHaveLength(0);
  });
});

describe('obtener la configuracion', () => {
  it('de un area: por defecto, propia o heredada', async () => {
    const { servicio, areas } = crearEscenario();
    expect(await servicio.obtenerDeArea(5, 11)).toEqual({
      diasVacaciones: null,
      diasEfectivos: 30,
      origen: 'PREDETERMINADO',
    });

    const padre = areas.get(10);
    if (padre) padre.diasVacaciones = 40;
    expect(await servicio.obtenerDeArea(5, 11)).toEqual({ diasVacaciones: null, diasEfectivos: 40, origen: 'HEREDADO' });
    expect(await servicio.obtenerDeArea(5, 10)).toEqual({ diasVacaciones: 40, diasEfectivos: 40, origen: 'PROPIO' });
  });

  it('de una persona: por defecto, heredada del area o propia', async () => {
    const { servicio, areas, personas } = crearEscenario();
    expect(await servicio.obtenerDePersona(5, 1)).toEqual({
      diasVacaciones: null,
      diasEfectivos: 30,
      origen: 'PREDETERMINADO',
    });

    const area = areas.get(11);
    if (area) area.diasVacaciones = 35;
    expect(await servicio.obtenerDePersona(5, 1)).toEqual({ diasVacaciones: null, diasEfectivos: 35, origen: 'HEREDADO' });

    const persona = personas.get(1);
    if (persona) persona.diasVacaciones = 28;
    expect(await servicio.obtenerDePersona(5, 1)).toEqual({ diasVacaciones: 28, diasEfectivos: 28, origen: 'PROPIO' });
  });

  it('un area o una persona de otro hospital no existe', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.obtenerDeArea(5, 20)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.obtenerDeArea(5, 999)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.obtenerDePersona(6, 1)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});

describe('fijar los dias', () => {
  it('de un area: queda propia, se deja constancia y null vuelve a heredar', async () => {
    const { servicio, constancias } = crearEscenario();

    const fijada = await servicio.fijarDeArea(superadmin(), 11, 35);
    expect(fijada).toEqual({ diasVacaciones: 35, diasEfectivos: 35, origen: 'PROPIO' });
    expect(constancias).toEqual([
      { empresaId: 5, actorId: 99, entidad: 'areas', entidadId: 11, antes: null, despues: 35 },
    ]);

    const quitada = await servicio.fijarDeArea(superadmin(), 11, null);
    expect(quitada).toEqual({ diasVacaciones: null, diasEfectivos: 30, origen: 'PREDETERMINADO' });
    expect(constancias[1]).toMatchObject({ antes: 35, despues: null });
  });

  it('de una persona: queda propia y se deja constancia', async () => {
    const { servicio, constancias } = crearEscenario();
    const fijada = await servicio.fijarDePersona(superadmin(), 1, 28);
    expect(fijada).toEqual({ diasVacaciones: 28, diasEfectivos: 28, origen: 'PROPIO' });
    expect(constancias).toEqual([
      { empresaId: 5, actorId: 99, entidad: 'usuarios', entidadId: 1, antes: null, despues: 28 },
    ]);
  });

  it('no cambia nada en un area ni en una persona de otro hospital', async () => {
    const { servicio, constancias } = crearEscenario();
    await expect(servicio.fijarDeArea(superadmin(), 20, 35)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.fijarDePersona(superadmin(6), 1, 28)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(constancias).toHaveLength(0);
  });
});