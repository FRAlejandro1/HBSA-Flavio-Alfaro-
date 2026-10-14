// Pruebas del repositorio de importacion contra MySQL real: aplicacion del plan en una transaccion,
// jefes resueltos por cedula, bajas y reversion completa ante un error.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import type { PlanAplicacion } from '../../../src/modules/importacion/importacion.dominio';
import { ImportacionRepository } from '../../../src/modules/importacion/importacion.repository';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new ImportacionRepository(bd);

function persona(cedula: string, cambios: Partial<PlanAplicacion['crear'][number]> = {}): PlanAplicacion['crear'][number] {
  return {
    cedula,
    nombres: 'Rosa',
    apellidos: 'Mena',
    correo: null,
    telefono: null,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    rol: 'EMPLEADO',
    fechaIngreso: '2021-05-10',
    ...cambios,
  };
}

const planVacio: PlanAplicacion = { crear: [], actualizar: [], jefes: [], bajas: [] };

async function contarUsuarios(): Promise<number> {
  const [fila] = await bd.consultar<{ total: number }>('SELECT COUNT(*) AS total FROM usuarios');
  return Number(fila?.total ?? 0);
}

beforeEach(async () => {
  await resetearDatos();
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('catalogos y personas', () => {
  it('lista las areas, los cargos y las personas solo del hospital, con la cedula del jefe', async () => {
    const jefe = await insertarUsuario({ empresaId: IDS.empresaA, areaId: IDS.areaA1, cargoId: IDS.cargoA1, cedula: '0100000001' });
    const id = await insertarUsuario({ empresaId: IDS.empresaA, areaId: IDS.areaA1, cargoId: IDS.cargoA1, cedula: '0100000002' });
    await bd.ejecutar('UPDATE usuarios SET jefe_inmediato_id = ? WHERE id = ?', [jefe, id]);
    await insertarUsuario({ empresaId: IDS.empresaB, areaId: IDS.areaB1, cargoId: IDS.cargoB1, cedula: '0900000001' });

    expect((await repositorio.listarAreas(IDS.empresaA)).map((a) => a.detalle).sort()).toEqual(['Consulta Externa', 'Emergencia']);
    expect(await repositorio.listarCargos(IDS.empresaA)).toHaveLength(2);
    const usuarios = await repositorio.listarUsuarios(IDS.empresaA);
    expect(usuarios).toHaveLength(2);
    expect(usuarios.find((u) => u.id === id)).toMatchObject({ jefeCedula: '0100000001', rol: 'EMPLEADO', estado: 'ACTIVO' });
  });
});

describe('aplicar', () => {
  it('crea, actualiza, resuelve jefes por cedula y da de baja en una sola operacion', async () => {
    const existente = await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      correo: 'ana@hospital.test',
    });
    const aBaja = await insertarUsuario({ empresaId: IDS.empresaA, areaId: IDS.areaA1, cargoId: IDS.cargoA1, cedula: '0100000002' });
    await bd.ejecutar('UPDATE usuarios SET token_id = ? WHERE id IN (?, ?)', ['token-vigente', existente, aBaja]);

    await repositorio.aplicar(IDS.empresaA, {
      crear: [persona('0200000001'), persona('0200000002', { correo: 'luis@hospital.test' })],
      actualizar: [
        { id: existente, cedula: '0100000001', cambios: { areaId: IDS.areaA2, rol: 'JEFE_AREA' }, cerrarSesion: true },
      ],
      // El primero depende de una persona que se crea en esta misma operacion
      jefes: [
        { cedula: '0200000001', cedulaJefe: '0200000002' },
        { cedula: '0200000002', cedulaJefe: '0100000001' },
      ],
      bajas: [{ id: aBaja, fechaBaja: '2026-10-01' }],
    });

    const usuarios = await repositorio.listarUsuarios(IDS.empresaA);
    const por = (cedula: string) => usuarios.find((u) => u.cedula === cedula);
    expect(usuarios).toHaveLength(4);
    expect(por('0200000001')).toMatchObject({ jefeCedula: '0200000002', areaId: IDS.areaA1 });
    expect(por('0200000002')).toMatchObject({ jefeCedula: '0100000001', correo: 'luis@hospital.test' });
    expect(por('0100000001')).toMatchObject({ areaId: IDS.areaA2, rol: 'JEFE_AREA' });
    expect(por('0100000002')).toMatchObject({ estado: 'INACTIVO', fechaBaja: '2026-10-01' });

    // Cambiar el rol y dar de baja borran el refresh token
    const tokens = await bd.consultar<{ id: number; token_id: string | null }>(
      'SELECT id, token_id FROM usuarios WHERE id IN (?, ?)',
      [existente, aBaja],
    );
    expect(tokens.every((t) => t.token_id === null)).toBe(true);
  });

  it('no guarda nada si una persona del plan viola una restriccion', async () => {
    await insertarUsuario({
      empresaId: IDS.empresaA,
      areaId: IDS.areaA1,
      cargoId: IDS.cargoA1,
      cedula: '0100000001',
      correo: 'ocupado@hospital.test',
    });
    const antes = await contarUsuarios();

    await expect(
      repositorio.aplicar(IDS.empresaA, {
        ...planVacio,
        crear: [persona('0200000001'), persona('0200000002', { correo: 'ocupado@hospital.test' })],
      }),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });

    // La primera persona tampoco quedo guardada
    expect(await contarUsuarios()).toBe(antes);
  });

  it('rechaza un area de otro hospital y no guarda nada', async () => {
    const antes = await contarUsuarios();
    await expect(
      repositorio.aplicar(IDS.empresaA, {
        ...planVacio,
        crear: [persona('0200000001'), persona('0200000002', { areaId: IDS.areaB1 })],
      }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
    expect(await contarUsuarios()).toBe(antes);
  });

  it('no toca a personas de otro hospital aunque el plan indique su id', async () => {
    const ajeno = await insertarUsuario({ empresaId: IDS.empresaB, areaId: IDS.areaB1, cargoId: IDS.cargoB1, cedula: '0900000001' });
    await repositorio.aplicar(IDS.empresaA, {
      ...planVacio,
      actualizar: [{ id: ajeno, cedula: '0900000001', cambios: { nombres: 'Intruso' }, cerrarSesion: false }],
      bajas: [{ id: ajeno, fechaBaja: '2026-10-01' }],
    });
    const [fila] = await repositorio.listarUsuarios(IDS.empresaB);
    expect(fila).toMatchObject({ nombres: 'Prueba', estado: 'ACTIVO', fechaBaja: null });
  });
});