// Pruebas del repositorio de usuarios contra MySQL real: claves foraneas compuestas, unicidad,
// busqueda con LIKE, paginacion, bajas y aislamiento por hospital.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import type { DatosNuevoUsuario } from '../../../src/modules/usuarios/usuarios.dominio';
import { UsuariosRepository } from '../../../src/modules/usuarios/usuarios.repository';
import { IDS, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new UsuariosRepository(bd);

// Persona base del hospital A; cada prueba cambia solo lo que necesita
function nuevo(cambios: Partial<DatosNuevoUsuario> = {}): DatosNuevoUsuario {
  return {
    cedula: '0102030405',
    nombres: 'Ana',
    apellidos: 'Perez',
    correo: null,
    telefono: null,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    rol: 'EMPLEADO',
    jefeInmediatoId: null,
    fechaIngreso: '2020-03-01',
    passwordHash: null,
    ...cambios,
  };
}

// Datos de una persona del hospital B
const delHospitalB: Partial<DatosNuevoUsuario> = {
  cedula: '0999999999',
  areaId: IDS.areaB1,
  cargoId: IDS.cargoB1,
};

const filtros = { pagina: 1, porPagina: 20 };

beforeEach(async () => {
  await resetearDatos();
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('crear y obtener', () => {
  it('crea una persona y la devuelve con su area, cargo y rol', async () => {
    const id = await repositorio.crear(IDS.empresaA, nuevo());
    const usuario = await repositorio.obtener(IDS.empresaA, id);
    expect(usuario).toMatchObject({
      cedula: '0102030405',
      rol: 'EMPLEADO',
      area: { id: IDS.areaA1, detalle: 'Emergencia' },
      cargo: { id: IDS.cargoA1, detalle: 'Medico' },
      jefeInmediato: null,
      fechaIngreso: '2020-03-01',
      estado: 'ACTIVO',
      fechaBaja: null,
      tieneCuenta: false,
    });
  });

  it('marca tieneCuenta cuando hay correo y clave', async () => {
    const id = await repositorio.crear(
      IDS.empresaA,
      nuevo({ correo: 'ana@hospital.test', passwordHash: 'hash-de-prueba' }),
    );
    expect((await repositorio.obtener(IDS.empresaA, id))?.tieneCuenta).toBe(true);
  });

  it('rechaza una cedula repetida en el hospital pero la permite en otro', async () => {
    await repositorio.crear(IDS.empresaA, nuevo());
    await expect(repositorio.crear(IDS.empresaA, nuevo())).rejects.toMatchObject({ codigo: 'CONFLICTO' });
    await expect(
      repositorio.crear(IDS.empresaB, nuevo({ ...delHospitalB, cedula: '0102030405' })),
    ).resolves.toBeGreaterThan(0);
  });

  it('rechaza un correo repetido en todo el sistema sin distinguir mayusculas', async () => {
    await repositorio.crear(IDS.empresaA, nuevo({ correo: 'Ana@Hospital.test' }));
    await expect(
      repositorio.crear(IDS.empresaB, nuevo({ ...delHospitalB, correo: 'ana@hospital.test' })),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('permite varias personas sin correo', async () => {
    await repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000001' }));
    await expect(repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000002' }))).resolves.toBeGreaterThan(0);
  });

  it('rechaza un area o un cargo de otro hospital', async () => {
    await expect(repositorio.crear(IDS.empresaA, nuevo({ areaId: IDS.areaB1 }))).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
    await expect(repositorio.crear(IDS.empresaA, nuevo({ cargoId: IDS.cargoB1 }))).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza un jefe inmediato de otro hospital', async () => {
    const ajeno = await repositorio.crear(IDS.empresaB, nuevo(delHospitalB));
    await expect(
      repositorio.crear(IDS.empresaA, nuevo({ jefeInmediatoId: ajeno })),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('la base rechaza una clave sin correo', async () => {
    await expect(repositorio.crear(IDS.empresaA, nuevo({ passwordHash: 'hash-de-prueba' }))).rejects.toThrow();
  });

  it('no devuelve personas de otro hospital', async () => {
    const id = await repositorio.crear(IDS.empresaA, nuevo());
    expect(await repositorio.obtener(IDS.empresaB, id)).toBeNull();
  });
});

describe('buscar', () => {
  async function crearEquipo(): Promise<void> {
    await repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000001', nombres: 'Ana', apellidos: 'Pérez' }));
    await repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000002', nombres: 'Luis', apellidos: 'Pérez' }));
    await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0200000003', nombres: 'Rosa', apellidos: 'Gómez', areaId: IDS.areaA2 }),
    );
    await repositorio.crear(IDS.empresaB, nuevo({ ...delHospitalB, nombres: 'Pedro', apellidos: 'Pérez' }));
  }

  it('encuentra por apellido sin distinguir mayusculas ni tildes', async () => {
    await crearEquipo();
    const resultado = await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: 'PEREZ' });
    expect(resultado.total).toBe(2);
    expect(resultado.usuarios.map((u) => u.nombres).sort()).toEqual(['Ana', 'Luis']);
  });

  it('cada palabra debe coincidir con el inicio de algun campo', async () => {
    await crearEquipo();
    const resultado = await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: 'perez lu' });
    expect(resultado.usuarios.map((u) => u.nombres)).toEqual(['Luis']);
  });

  it('busca por inicio de cedula', async () => {
    await crearEquipo();
    const resultado = await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: '0200' });
    expect(resultado.usuarios.map((u) => u.nombres)).toEqual(['Rosa']);
  });

  it('trata los comodines de LIKE como texto literal', async () => {
    await crearEquipo();
    const porcentaje = await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: '%' });
    const guion = await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: '_' });
    expect(porcentaje.total).toBe(0);
    expect(guion.total).toBe(0);
  });

  it('no mezcla personas de otro hospital en la lista ni en el total', async () => {
    await crearEquipo();
    const resultado = await repositorio.buscar(IDS.empresaA, filtros);
    expect(resultado.total).toBe(3);
  });

  it('pagina los resultados y mantiene el total', async () => {
    await crearEquipo();
    const segunda = await repositorio.buscar(IDS.empresaA, { pagina: 2, porPagina: 2 });
    expect(segunda.total).toBe(3);
    expect(segunda.usuarios).toHaveLength(1);
  });

  it('filtra por area y por estado', async () => {
    await crearEquipo();
    const enConsulta = await repositorio.buscar(IDS.empresaA, { ...filtros, areaId: IDS.areaA2 });
    expect(enConsulta.usuarios.map((u) => u.nombres)).toEqual(['Rosa']);

    const [ana] = (await repositorio.buscar(IDS.empresaA, { ...filtros, busqueda: 'ana' })).usuarios;
    await repositorio.darDeBaja(IDS.empresaA, ana?.id ?? 0, null);
    const inactivos = await repositorio.buscar(IDS.empresaA, { ...filtros, estado: 'INACTIVO' });
    expect(inactivos.usuarios.map((u) => u.nombres)).toEqual(['Ana']);
  });
});

describe('actualizar', () => {
  it('cambia el rol, asigna jefe y cierra la sesion', async () => {
    const jefe = await repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000001' }));
    const id = await repositorio.crear(IDS.empresaA, nuevo({ cedula: '0100000002' }));
    await bd.ejecutar('UPDATE usuarios SET token_id = ? WHERE id = ?', ['token-vigente', id]);

    await repositorio.actualizar(IDS.empresaA, id, {
      rol: 'JEFE_AREA',
      jefeInmediatoId: jefe,
      cerrarSesion: true,
    });

    const usuario = await repositorio.obtener(IDS.empresaA, id);
    expect(usuario).toMatchObject({ rol: 'JEFE_AREA', jefeInmediato: { id: jefe } });
    const [fila] = await bd.consultar<{ token_id: string | null }>(
      'SELECT token_id FROM usuarios WHERE id = ?',
      [id],
    );
    expect(fila?.token_id).toBeNull();
  });

  it('no modifica a una persona de otro hospital', async () => {
    const id = await repositorio.crear(IDS.empresaB, nuevo(delHospitalB));
    await repositorio.actualizar(IDS.empresaA, id, { nombres: 'Intruso' });
    expect((await repositorio.obtener(IDS.empresaB, id))?.nombres).toBe('Ana');
  });

  it('quita el correo y la clave a la vez', async () => {
    const id = await repositorio.crear(
      IDS.empresaA,
      nuevo({ correo: 'ana@hospital.test', passwordHash: 'hash-de-prueba' }),
    );
    await repositorio.actualizar(IDS.empresaA, id, { passwordHash: null, correo: null });
    expect(await repositorio.obtener(IDS.empresaA, id)).toMatchObject({ correo: null, tieneCuenta: false });
  });
});

describe('configurar dias de vacaciones', () => {
  it('establece la excepcion individual y registra la auditoria', async () => {
    const actorId = await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0100000001', rol: 'SUPERADMIN' }),
    );
    const empleadoId = await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0100000002' }),
    );

    const resultado = await repositorio.configurarDiasVacaciones(
      IDS.empresaA,
      actorId,
      empleadoId,
      25.5,
    );

    expect(resultado).toBe(25.5);

    const [usuario] = await bd.consultar<{ dias_vacaciones: number | string | null }>(
      'SELECT dias_vacaciones FROM usuarios WHERE empresa_id = ? AND id = ?',
      [IDS.empresaA, empleadoId],
    );
    expect(Number(usuario?.dias_vacaciones)).toBe(25.5);

    const [auditoria] = await bd.consultar<{
      empresa_id: number;
      usuario_id: number;
      accion: string;
      entidad: string;
      entidad_id: number;
    }>(
      `SELECT empresa_id, usuario_id, accion, entidad, entidad_id
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'USUARIO' AND entidad_id = ?`,
      [IDS.empresaA, empleadoId],
    );

    expect(auditoria).toMatchObject({
      empresa_id: IDS.empresaA,
      usuario_id: actorId,
      accion: 'ACTUALIZACION_DIAS_VACACIONES_EMPLEADO',
      entidad: 'USUARIO',
      entidad_id: empleadoId,
    });
  });

  it('permite restablecer la herencia del area mediante null', async () => {
    const actorId = await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0100000001', rol: 'SUPERADMIN' }),
    );
    const empleadoId = await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0100000002' }),
    );

    await repositorio.configurarDiasVacaciones(
      IDS.empresaA,
      actorId,
      empleadoId,
      25.5,
    );

    const resultado = await repositorio.configurarDiasVacaciones(
      IDS.empresaA,
      actorId,
      empleadoId,
      null,
    );

    expect(resultado).toBeNull();

    const [usuario] = await bd.consultar<{ dias_vacaciones: number | string | null }>(
      'SELECT dias_vacaciones FROM usuarios WHERE empresa_id = ? AND id = ?',
      [IDS.empresaA, empleadoId],
    );
    expect(usuario?.dias_vacaciones).toBeNull();

    const auditorias = await bd.consultar<{
      detalle: { antes: number | null; despues: number | null } | string;
    }>(
      `SELECT detalle
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'USUARIO' AND entidad_id = ?
       ORDER BY id`,
      [IDS.empresaA, empleadoId],
    );

    expect(auditorias).toHaveLength(2);

    const ultimoDetalle: unknown =
      typeof auditorias[1]?.detalle === 'string'
        ? JSON.parse(auditorias[1].detalle)
        : auditorias[1]?.detalle;

    expect(ultimoDetalle).toEqual({ antes: 25.5, despues: null });
  });

  it('no modifica empleados de otro hospital', async () => {
    const actorId = await repositorio.crear(
      IDS.empresaA,
      nuevo({ cedula: '0100000001', rol: 'SUPERADMIN' }),
    );
    const empleadoId = await repositorio.crear(
      IDS.empresaB,
      nuevo({ ...delHospitalB, cedula: '0100000002' }),
    );

    await expect(
      repositorio.configurarDiasVacaciones(
        IDS.empresaA,
        actorId,
        empleadoId,
        25.5,
      ),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    const [usuario] = await bd.consultar<{ dias_vacaciones: number | string | null }>(
      'SELECT dias_vacaciones FROM usuarios WHERE empresa_id = ? AND id = ?',
      [IDS.empresaB, empleadoId],
    );

    expect(usuario?.dias_vacaciones).toBeNull();

    const auditorias = await bd.consultar<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM audit_log
       WHERE empresa_id = ? AND entidad = 'USUARIO' AND entidad_id = ?`,
      [IDS.empresaA, empleadoId],
    );

    expect(Number(auditorias[0]?.total ?? 0)).toBe(0);
  });
});

describe('baja y reactivacion', () => {
  it('da de baja con la fecha de hoy de la base y borra el refresh token', async () => {
    const id = await repositorio.crear(IDS.empresaA, nuevo());
    await bd.ejecutar('UPDATE usuarios SET token_id = ? WHERE id = ?', ['token-vigente', id]);

    await repositorio.darDeBaja(IDS.empresaA, id, null);

    const [hoy] = await bd.consultar<{ hoy: string }>('SELECT CURDATE() AS hoy');
    expect(await repositorio.obtener(IDS.empresaA, id)).toMatchObject({
      estado: 'INACTIVO',
      fechaBaja: hoy?.hoy,
    });
    const [fila] = await bd.consultar<{ token_id: string | null }>(
      'SELECT token_id FROM usuarios WHERE id = ?',
      [id],
    );
    expect(fila?.token_id).toBeNull();
  });

  it('usa la fecha de baja indicada y la reactivacion la limpia', async () => {
    const id = await repositorio.crear(IDS.empresaA, nuevo());
    await repositorio.darDeBaja(IDS.empresaA, id, '2026-10-01');
    expect((await repositorio.obtener(IDS.empresaA, id))?.fechaBaja).toBe('2026-10-01');

    await repositorio.reactivar(IDS.empresaA, id);
    expect(await repositorio.obtener(IDS.empresaA, id)).toMatchObject({ estado: 'ACTIVO', fechaBaja: null });
  });
});