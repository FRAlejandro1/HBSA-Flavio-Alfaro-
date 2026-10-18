// Pruebas del service de organizacion con el repositorio en memoria.
import { describe, expect, it } from 'vitest';
import type { DatosArea } from '../../../../src/modules/organizacion/organizacion.dominio';
import { OrganizacionService } from '../../../../src/modules/organizacion/organizacion.service';
import { crearOrganizacionEnMemoria } from '../../../helpers/organizacion';

function crearEscenario() {
  const memoria = crearOrganizacionEnMemoria();
  return { ...memoria, servicio: new OrganizacionService(memoria.repositorio) };
}

// Area principal del proceso 1 (gobernante) salvo que se indique otra cosa
function datosArea(detalle: string, cambios: Partial<DatosArea> = {}): DatosArea {
  return { detalle, jefeId: null, parentId: null, procesoId: 1, ...cambios };
}

describe('procesos', () => {
  it('lista los cuatro procesos institucionales', async () => {
    const { servicio } = crearEscenario();
    const procesos = await servicio.listarProcesos();
    expect(procesos.map((p) => p.codigo)).toEqual([
      'GOBERNANTE',
      'AGREGADOR_VALOR',
      'HABILITANTE_ASESORIA',
      'HABILITANTE_APOYO',
    ]);
  });
});

describe('areas', () => {
  it('crea un area y la devuelve completa, sin jefe', async () => {
    const { servicio } = crearEscenario();
    const area = await servicio.crearArea(5, datosArea('Emergencia', { procesoId: 2 }));
    expect(area).toMatchObject({ detalle: 'Emergencia', jefe: null, parentId: null, procesoId: 2 });
  });

  it('crea un area con jefe', async () => {
    const { servicio } = crearEscenario();
    const area = await servicio.crearArea(5, datosArea('Consulta Externa', { jefeId: 3 }));
    expect(area.jefe).toMatchObject({ id: 3 });
  });

  it('no lista las areas de otro hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, datosArea('Emergencia'));
    await servicio.crearArea(6, datosArea('Quirofano'));
    const propias = await servicio.listarAreas(5);
    expect(propias.map((a) => a.detalle)).toEqual(['Emergencia']);
  });

  it('rechaza un area duplicada en el mismo hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, datosArea('Emergencia'));
    await expect(servicio.crearArea(5, datosArea('Emergencia'))).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('permite el mismo nombre en otro hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, datosArea('Emergencia'));
    await expect(servicio.crearArea(6, datosArea('Emergencia'))).resolves.toBeDefined();
  });

  it('actualiza el nombre y quita al jefe', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crearArea(5, datosArea('Emergencia', { jefeId: 3 }));
    const area = await servicio.actualizarArea(5, creada.id, { detalle: 'Urgencias', jefeId: null });
    expect(area).toMatchObject({ detalle: 'Urgencias', jefe: null });
  });

  it('no actualiza un area inexistente ni la de otro hospital', async () => {
    const { servicio } = crearEscenario();
    const ajena = await servicio.crearArea(6, datosArea('Quirofano'));
    await expect(servicio.actualizarArea(5, 9999, { detalle: 'x' })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await expect(servicio.actualizarArea(5, ajena.id, { detalle: 'x' })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('no elimina un area inexistente', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.eliminarArea(5, 9999)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('no elimina un area en uso', async () => {
    const { servicio, areasEnUso } = crearEscenario();
    const area = await servicio.crearArea(5, datosArea('Emergencia'));
    areasEnUso.add(area.id);
    await expect(servicio.eliminarArea(5, area.id)).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });
});

describe('proceso y subareas', () => {
  it('un area principal necesita proceso', async () => {
    const { servicio } = crearEscenario();
    await expect(
      servicio.crearArea(5, datosArea('Emergencia', { procesoId: null })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza un proceso que no existe', async () => {
    const { servicio } = crearEscenario();
    await expect(
      servicio.crearArea(5, datosArea('Emergencia', { procesoId: 99 })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('una subarea hereda el proceso de su padre', async () => {
    const { servicio } = crearEscenario();
    const padre = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    const hija = await servicio.crearArea(
      5,
      datosArea('Laboratorio', { parentId: padre.id, procesoId: null }),
    );
    expect(hija).toMatchObject({ parentId: padre.id, procesoId: 2 });
  });

  it('rechaza una subarea con un proceso distinto al de su padre', async () => {
    const { servicio } = crearEscenario();
    const padre = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    await expect(
      servicio.crearArea(5, datosArea('Laboratorio', { parentId: padre.id, procesoId: 4 })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza un area padre inexistente o de otro hospital', async () => {
    const { servicio } = crearEscenario();
    const ajena = await servicio.crearArea(6, datosArea('Quirofano'));
    await expect(
      servicio.crearArea(5, datosArea('Laboratorio', { parentId: 9999, procesoId: null })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
    await expect(
      servicio.crearArea(5, datosArea('Laboratorio', { parentId: ajena.id, procesoId: null })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('arma el arbol con las subareas dentro de sus padres', async () => {
    const { servicio } = crearEscenario();
    const apoyo = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    const direccion = await servicio.crearArea(5, datosArea('Direccion'));
    await servicio.crearArea(5, datosArea('Laboratorio', { parentId: apoyo.id, procesoId: null }));
    await servicio.crearArea(5, datosArea('Imagenologia', { parentId: apoyo.id, procesoId: null }));
    await servicio.crearArea(6, datosArea('Quirofano'));

    const arbol = await servicio.listarArbol(5);
    expect(arbol.map((n) => n.id)).toEqual([apoyo.id, direccion.id]);
    expect(arbol[0]?.hijos.map((h) => h.detalle)).toEqual(['Imagenologia', 'Laboratorio']);
    expect(arbol[1]?.hijos).toEqual([]);
  });

  it('mueve una subarea a otro padre del mismo proceso', async () => {
    const { servicio } = crearEscenario();
    const a = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    const b = await servicio.crearArea(5, datosArea('Especialidades', { procesoId: 2 }));
    const hija = await servicio.crearArea(5, datosArea('Laboratorio', { parentId: a.id, procesoId: null }));
    const movida = await servicio.actualizarArea(5, hija.id, { parentId: b.id });
    expect(movida.parentId).toBe(b.id);
  });

  it('una subarea pasa a area principal con parentId en null y conserva su proceso', async () => {
    const { servicio } = crearEscenario();
    const padre = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    const hija = await servicio.crearArea(5, datosArea('Laboratorio', { parentId: padre.id, procesoId: null }));
    const area = await servicio.actualizarArea(5, hija.id, { parentId: null });
    expect(area).toMatchObject({ parentId: null, procesoId: 2 });
  });

  it('rechaza mover un area a otro proceso', async () => {
    const { servicio } = crearEscenario();
    const apoyo = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    const hija = await servicio.crearArea(5, datosArea('Laboratorio', { parentId: apoyo.id, procesoId: null }));
    const otro = await servicio.crearArea(5, datosArea('Talento Humano', { procesoId: 4 }));
    await expect(servicio.actualizarArea(5, hija.id, { parentId: otro.id })).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza que un area sea su propio padre', async () => {
    const { servicio } = crearEscenario();
    const area = await servicio.crearArea(5, datosArea('Emergencia'));
    await expect(servicio.actualizarArea(5, area.id, { parentId: area.id })).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza un ciclo: un area dentro de una de sus descendientes', async () => {
    const { servicio } = crearEscenario();
    const a = await servicio.crearArea(5, datosArea('A'));
    const b = await servicio.crearArea(5, datosArea('B', { parentId: a.id, procesoId: null }));
    const c = await servicio.crearArea(5, datosArea('C', { parentId: b.id, procesoId: null }));
    await expect(servicio.actualizarArea(5, a.id, { parentId: c.id })).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('no elimina un area que tiene subareas', async () => {
    const { servicio } = crearEscenario();
    const padre = await servicio.crearArea(5, datosArea('Apoyo Diagnostico', { procesoId: 2 }));
    await servicio.crearArea(5, datosArea('Laboratorio', { parentId: padre.id, procesoId: null }));
    await expect(servicio.eliminarArea(5, padre.id)).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });
});

describe('cargos', () => {
  const datos = {
    detalle: 'Medico',
    grado: null,
    rolPuesto: null,
    nivelJerarquico: 5,
    responsabilidad: 'Atender pacientes',
    funciones: 'Diagnosticar',
  };

  it('crea y lista cargos', async () => {
    const { servicio } = crearEscenario();
    const cargo = await servicio.crearCargo(5, datos);
    expect(cargo).toMatchObject(datos);
    expect(await servicio.listarCargos(5)).toHaveLength(1);
  });

  it('guarda grado, rol del puesto y nivel jerarquico', async () => {
    const { servicio } = crearEscenario();
    const cargo = await servicio.crearCargo(5, {
      ...datos,
      detalle: 'Enfermero/a 6',
      grado: 6,
      rolPuesto: 'Ejecucion y Coordinacion de Procesos',
      nivelJerarquico: 4,
    });
    expect(cargo).toMatchObject({
      grado: 6,
      rolPuesto: 'Ejecucion y Coordinacion de Procesos',
      nivelJerarquico: 4,
    });
  });

  it('una actualizacion parcial conserva el resto de los campos', async () => {
    const { servicio } = crearEscenario();
    const creado = await servicio.crearCargo(5, datos);
    const cargo = await servicio.actualizarCargo(5, creado.id, { funciones: 'Operar' });
    expect(cargo).toMatchObject({ detalle: 'Medico', funciones: 'Operar', nivelJerarquico: 5 });
  });

  it('no elimina un cargo inexistente', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.eliminarCargo(5, 9999)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});