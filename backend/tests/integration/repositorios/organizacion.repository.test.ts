// Pruebas del repositorio de organizacion contra MySQL real: restricciones de la base y aislamiento por hospital.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { OrganizacionRepository } from '../../../src/modules/organizacion/organizacion.repository';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const repositorio = new OrganizacionRepository(obtenerBaseDatos());

const cargoNuevo = {
  detalle: 'Laboratorista',
  responsabilidad: 'Responsabilidad de prueba',
  funciones: 'Funciones de prueba',
};

beforeEach(async () => {
  await resetearDatos();
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('areas', () => {
  it('lista solo las areas del hospital, ordenadas por nombre', async () => {
    const areas = await repositorio.listarAreas(IDS.empresaA);
    expect(areas.map((a) => a.detalle)).toEqual(['Consulta Externa', 'Emergencia']);
  });

  it('rechaza un area duplicada en el hospital y la permite en otro', async () => {
    await expect(
      repositorio.crearArea(IDS.empresaA, { detalle: 'Emergencia', jefeId: null }),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
    await expect(
      repositorio.crearArea(IDS.empresaB, { detalle: 'Emergencia', jefeId: null }),
    ).resolves.toBeGreaterThan(0);
  });

  it('acepta como jefe a alguien del hospital y lo muestra al consultar el area', async () => {
    const jefe = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      nombres: 'Rosa',
      apellidos: 'Mena',
    });
    const id = await repositorio.crearArea(IDS.empresaA, { detalle: 'Laboratorio', jefeId: jefe });
    const area = await repositorio.buscarArea(IDS.empresaA, id);
    expect(area?.jefe).toEqual({ id: jefe, nombres: 'Rosa', apellidos: 'Mena' });
  });

  it('rechaza como jefe a alguien de otro hospital', async () => {
    const ajeno = await insertarUsuario({
      empresaId: IDS.empresaB,
      areaId: IDS.areaB1,
      cargoId: IDS.cargoB1,
      cedula: '0900000001',
    });
    await expect(
      repositorio.crearArea(IDS.empresaA, { detalle: 'Laboratorio', jefeId: ajeno }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('actualiza el nombre y quita al jefe', async () => {
    const jefe = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
    });
    await repositorio.actualizarArea(IDS.empresaA, IDS.areaA1, { detalle: 'Urgencias', jefeId: jefe });
    await repositorio.actualizarArea(IDS.empresaA, IDS.areaA1, { jefeId: null });
    const area = await repositorio.buscarArea(IDS.empresaA, IDS.areaA1);
    expect(area).toMatchObject({ detalle: 'Urgencias', jefe: null });
  });

  it('no elimina un area con personal asignado', async () => {
    await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
    });
    await expect(repositorio.eliminarArea(IDS.empresaA, IDS.areaA1)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('elimina un area sin uso y no toca las de otro hospital ni las que no existen', async () => {
    expect(await repositorio.eliminarArea(IDS.empresaA, IDS.areaA2)).toBe(true);
    expect(await repositorio.eliminarArea(IDS.empresaA, IDS.areaA2)).toBe(false);
    expect(await repositorio.eliminarArea(IDS.empresaA, IDS.areaB1)).toBe(false);
    expect(await repositorio.buscarArea(IDS.empresaB, IDS.areaB1)).not.toBeNull();
  });
});

describe('cargos', () => {
  it('crea un cargo y rechaza el nombre repetido en el hospital', async () => {
    const id = await repositorio.crearCargo(IDS.empresaA, cargoNuevo);
    expect(await repositorio.buscarCargo(IDS.empresaA, id)).toMatchObject(cargoNuevo);
    await expect(repositorio.crearCargo(IDS.empresaA, cargoNuevo)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('una actualizacion parcial conserva el resto de los campos', async () => {
    await repositorio.actualizarCargo(IDS.empresaA, IDS.cargoA1, { funciones: 'Operar' });
    const cargo = await repositorio.buscarCargo(IDS.empresaA, IDS.cargoA1);
    expect(cargo).toMatchObject({ detalle: 'Medico', funciones: 'Operar' });
  });

  it('no elimina un cargo asignado a personal', async () => {
    await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
    });
    await expect(repositorio.eliminarCargo(IDS.empresaA, IDS.cargoA1)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('no encuentra los cargos de otro hospital', async () => {
    expect(await repositorio.buscarCargo(IDS.empresaA, IDS.cargoB1)).toBeNull();
    expect(await repositorio.listarCargos(IDS.empresaA)).toHaveLength(2);
  });
});