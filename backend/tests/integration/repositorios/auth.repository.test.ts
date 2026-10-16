// Pruebas del repositorio de autenticacion contra MySQL real: busqueda de credenciales,
// perfil por hospital y rotacion atomica del refresh token.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { AuthRepository } from '../../../src/modules/auth/auth.repository';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new AuthRepository(bd);

// Persona del hospital A con cuenta de acceso
async function crearConCuenta(estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO'): Promise<number> {
  const id = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0100000001',
    rol: 'JEFE_AREA',
    correo: 'jefe@hospital.test',
    passwordHash: 'hash-de-prueba',
    nombres: 'Rosa',
    apellidos: 'Mena',
  });
  if (estado === 'INACTIVO') {
    await bd.ejecutar("UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?", [id]);
  }
  return id;
}

beforeEach(async () => {
  await resetearDatos();
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('buscarCredencialesPorCorreo', () => {
  it('devuelve hash, rol y hospital de una persona activa', async () => {
    const id = await crearConCuenta();
    expect(await repositorio.buscarCredencialesPorCorreo('jefe@hospital.test')).toEqual({
      id,
      empresaId: IDS.empresaA,
      passwordHash: 'hash-de-prueba',
      rol: 'JEFE_AREA',
    });
  });

  it('no distingue mayusculas en el correo', async () => {
    await crearConCuenta();
    expect(await repositorio.buscarCredencialesPorCorreo('JEFE@Hospital.test')).not.toBeNull();
  });

  it('no devuelve a quien esta dado de baja ni a un correo desconocido', async () => {
    await crearConCuenta('INACTIVO');
    expect(await repositorio.buscarCredencialesPorCorreo('jefe@hospital.test')).toBeNull();
    expect(await repositorio.buscarCredencialesPorCorreo('nadie@hospital.test')).toBeNull();
  });

  it('no devuelve a una persona de un hospital inactivo', async () => {
    await crearConCuenta();
    await bd.ejecutar("UPDATE empresas SET estado = 'INACTIVA' WHERE id = ?", [IDS.empresaA]);
    expect(await repositorio.buscarCredencialesPorCorreo('jefe@hospital.test')).toBeNull();
  });
});

describe('buscarPerfil y buscarSesionPorId', () => {
  it('devuelve el perfil con hospital, area y cargo', async () => {
    const id = await crearConCuenta();
    expect(await repositorio.buscarPerfil(IDS.empresaA, id)).toMatchObject({
      id,
      nombres: 'Rosa',
      correo: 'jefe@hospital.test',
      rol: 'JEFE_AREA',
      empresa: { id: IDS.empresaA, nombre: 'Hospital A' },
      area: { detalle: 'Emergencia' },
      cargo: { detalle: 'Medico' },
    });
  });

  it('no resuelve a la persona con el hospital equivocado', async () => {
    const id = await crearConCuenta();
    expect(await repositorio.buscarPerfil(IDS.empresaB, id)).toBeNull();
  });

  it('la sesion solo existe para personas activas', async () => {
    const id = await crearConCuenta();
    expect(await repositorio.buscarSesionPorId(id)).toEqual({
      id,
      empresaId: IDS.empresaA,
      rol: 'JEFE_AREA',
    });
    await bd.ejecutar("UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?", [id]);
    expect(await repositorio.buscarSesionPorId(id)).toBeNull();
  });
});

describe('rotarTokenId', () => {
  it('rota solo si el jti anterior coincide', async () => {
    const id = await crearConCuenta();
    await repositorio.guardarTokenId(id, 'jti-0');
    expect(await repositorio.rotarTokenId(id, 'jti-0', 'jti-1')).toBe(true);
    expect(await repositorio.rotarTokenId(id, 'jti-0', 'jti-2')).toBe(false);
  });

  it('con dos rotaciones simultaneas del mismo token solo una gana', async () => {
    const id = await crearConCuenta();
    await repositorio.guardarTokenId(id, 'jti-0');
    const resultados = await Promise.all([
      repositorio.rotarTokenId(id, 'jti-0', 'jti-1'),
      repositorio.rotarTokenId(id, 'jti-0', 'jti-2'),
    ]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it('no rota el token de una persona dada de baja', async () => {
    const id = await crearConCuenta('INACTIVO');
    await repositorio.guardarTokenId(id, 'jti-0');
    expect(await repositorio.rotarTokenId(id, 'jti-0', 'jti-1')).toBe(false);
  });

  it('guardar null borra el token vigente', async () => {
    const id = await crearConCuenta();
    await repositorio.guardarTokenId(id, 'jti-0');
    await repositorio.guardarTokenId(id, null);
    expect(await repositorio.rotarTokenId(id, 'jti-0', 'jti-1')).toBe(false);
  });
});