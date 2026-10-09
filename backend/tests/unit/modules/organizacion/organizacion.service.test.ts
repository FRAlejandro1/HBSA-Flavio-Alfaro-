// Pruebas del service de organizacion con el repositorio en memoria.
import { describe, expect, it } from 'vitest';
import { OrganizacionService } from '../../../../src/modules/organizacion/organizacion.service';
import { crearOrganizacionEnMemoria } from '../../../helpers/organizacion';

function crearEscenario() {
  const memoria = crearOrganizacionEnMemoria();
  return { ...memoria, servicio: new OrganizacionService(memoria.repositorio) };
}

describe('areas', () => {
  it('crea un area y la devuelve completa, sin jefe', async () => {
    const { servicio } = crearEscenario();
    const area = await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
    expect(area).toMatchObject({ detalle: 'Emergencia', jefe: null });
  });

  it('crea un area con jefe', async () => {
    const { servicio } = crearEscenario();
    const area = await servicio.crearArea(5, { detalle: 'Consulta Externa', jefeId: 3 });
    expect(area.jefe).toMatchObject({ id: 3 });
  });

  it('no lista las areas de otro hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
    await servicio.crearArea(6, { detalle: 'Quirofano', jefeId: null });
    const propias = await servicio.listarAreas(5);
    expect(propias.map((a) => a.detalle)).toEqual(['Emergencia']);
  });

  it('rechaza un area duplicada en el mismo hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
    await expect(servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null })).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('permite el mismo nombre en otro hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
    await expect(servicio.crearArea(6, { detalle: 'Emergencia', jefeId: null })).resolves.toBeDefined();
  });

  it('actualiza el nombre y quita al jefe', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: 3 });
    const area = await servicio.actualizarArea(5, creada.id, { detalle: 'Urgencias', jefeId: null });
    expect(area).toMatchObject({ detalle: 'Urgencias', jefe: null });
  });

  it('no actualiza un area inexistente ni la de otro hospital', async () => {
    const { servicio } = crearEscenario();
    const ajena = await servicio.crearArea(6, { detalle: 'Quirofano', jefeId: null });
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
    const area = await servicio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
    areasEnUso.add(area.id);
    await expect(servicio.eliminarArea(5, area.id)).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });
});

describe('cargos', () => {
  const datos = { detalle: 'Medico', responsabilidad: 'Atender pacientes', funciones: 'Diagnosticar' };

  it('crea y lista cargos', async () => {
    const { servicio } = crearEscenario();
    const cargo = await servicio.crearCargo(5, datos);
    expect(cargo).toMatchObject(datos);
    expect(await servicio.listarCargos(5)).toHaveLength(1);
  });

  it('una actualizacion parcial conserva el resto de los campos', async () => {
    const { servicio } = crearEscenario();
    const creado = await servicio.crearCargo(5, datos);
    const cargo = await servicio.actualizarCargo(5, creado.id, { funciones: 'Operar' });
    expect(cargo).toMatchObject({ detalle: 'Medico', funciones: 'Operar' });
  });

  it('no elimina un cargo inexistente', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.eliminarCargo(5, 9999)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});