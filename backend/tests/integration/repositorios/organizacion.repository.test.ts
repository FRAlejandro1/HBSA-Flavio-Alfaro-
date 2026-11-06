// Pruebas del repositorio de organizacion contra MySQL real: restricciones de la base y aislamiento por hospital.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { OrganizacionRepository } from '../../../src/modules/organizacion/organizacion.repository';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();

const repositorio = new OrganizacionRepository(obtenerBaseDatos());

// Proceso institucional de las areas de prueba: el catalogo lo carga la migracion 006 (2 es AGREGADOR_VALOR)
const PROCESO = 2;

// Datos de un area principal (sin area padre) dentro del proceso de prueba
function areaNueva(detalle: string, jefeId: number | null = null) {
  return { detalle, jefeId, parentId: null, procesoId: PROCESO };
}

const cargoNuevo = {
  detalle: 'Laboratorista',
  grado: null,
  rolPuesto: null,
  nivelJerarquico: 5,
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
    await expect(repositorio.crearArea(IDS.empresaA, areaNueva('Emergencia'))).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
    await expect(repositorio.crearArea(IDS.empresaB, areaNueva('Emergencia'))).resolves.toBeGreaterThan(0);
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
    const id = await repositorio.crearArea(IDS.empresaA, areaNueva('Laboratorio', jefe));
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
    await expect(repositorio.crearArea(IDS.empresaA, areaNueva('Laboratorio', ajeno))).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('crea una subarea dentro de un area y la muestra con su padre y su proceso', async () => {
    const id = await repositorio.crearArea(IDS.empresaA, {
      detalle: 'Triaje',
      jefeId: null,
      parentId: IDS.areaA1,
      procesoId: PROCESO,
    });
    const area = await repositorio.buscarArea(IDS.empresaA, id);
    expect(area).toMatchObject({ detalle: 'Triaje', parentId: IDS.areaA1, procesoId: PROCESO });
  });

  it('rechaza una subarea cuyo area padre es de otro hospital', async () => {
    await expect(
      repositorio.crearArea(IDS.empresaA, {
        detalle: 'Triaje',
        jefeId: null,
        parentId: IDS.areaB1,
        procesoId: PROCESO,
      }),
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

  it('no elimina un area que tiene subareas', async () => {
    await repositorio.crearArea(IDS.empresaA, {
      detalle: 'Triaje',
      jefeId: null,
      parentId: IDS.areaA1,
      procesoId: PROCESO,
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

describe('configuracion de dias de vacaciones por area', () => {
  it('configura los dias del area y registra la auditoria', async () => {
    const actorId = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      rol: 'SUPERADMIN',
    });

    await expect(
      repositorio.configurarDiasVacacionesArea(IDS.empresaA, actorId, IDS.areaA1, 25.5),
    ).resolves.toBe(25.5);

    const area = await repositorio.buscarArea(IDS.empresaA, IDS.areaA1);
    expect(area?.diasVacaciones).toBe(25.5);

    const auditorias = await bd.consultar<{
      empresa_id: number;
      usuario_id: number;
      accion: string;
      entidad: string;
      entidad_id: number;
    }>(
      `SELECT empresa_id, usuario_id, accion, entidad, entidad_id
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'AREA' AND entidad_id = ?`,
      [IDS.empresaA, IDS.areaA1],
    );

    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      empresa_id: IDS.empresaA,
      usuario_id: actorId,
      accion: 'ACTUALIZACION_DIAS_VACACIONES_AREA',
      entidad: 'AREA',
      entidad_id: IDS.areaA1,
    });
  });

  it('permite restablecer la herencia institucional mediante null', async () => {
    const actorId = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      rol: 'SUPERADMIN',
    });

    await repositorio.configurarDiasVacacionesArea(IDS.empresaA, actorId, IDS.areaA1, 25.5);
    await repositorio.configurarDiasVacacionesArea(IDS.empresaA, actorId, IDS.areaA1, null);

    const area = await repositorio.buscarArea(IDS.empresaA, IDS.areaA1);
    expect(area?.diasVacaciones).toBeNull();

    const auditorias = await bd.consultar<{
      detalle: { antes: number | null; despues: number | null } | string;
    }>(
      `SELECT detalle
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'AREA' AND entidad_id = ?
       ORDER BY id`,
      [IDS.empresaA, IDS.areaA1],
    );

    expect(auditorias).toHaveLength(2);

    const ultimoDetalle: unknown =
      typeof auditorias[1]?.detalle === 'string'
        ? JSON.parse(auditorias[1].detalle)
        : auditorias[1]?.detalle;

    expect(ultimoDetalle).toEqual({ antes: 25.5, despues: null });
  });

  it('no permite configurar un area de otro hospital ni genera auditoria', async () => {
    const actorId = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      rol: 'SUPERADMIN',
    });

    await expect(
      repositorio.configurarDiasVacacionesArea(IDS.empresaA, actorId, IDS.areaB1, 25.5),
    ).rejects.toThrow('AREA_NO_ENCONTRADA');

    const areaAjena = await repositorio.buscarArea(IDS.empresaB, IDS.areaB1);
    expect(areaAjena?.diasVacaciones).toBeNull();

    const auditorias = await bd.consultar<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'AREA' AND entidad_id = ?`,
      [IDS.empresaA, IDS.areaB1],
    );

    expect(Number(auditorias[0]?.total ?? 0)).toBe(0);
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