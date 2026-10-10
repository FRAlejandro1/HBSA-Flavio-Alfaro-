// Pruebas del service de usuarios con el repositorio en memoria y un hash falso (sin Argon2).
import { describe, expect, it } from 'vitest';
import { UsuariosService } from '../../../../src/modules/usuarios/usuarios.service';
import type { CrearUsuarioEntrada } from '../../../../src/modules/usuarios/usuarios.validators';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import { crearUsuariosEnMemoria } from '../../../helpers/usuarios';

const superadmin: UsuarioAutenticado = {
  id: 1,
  empresaId: 5,
  rol: 'SUPERADMIN',
  jti: 'jti-superadmin',
  expira: 9_999_999_999,
};
const talento: UsuarioAutenticado = { ...superadmin, id: 2, rol: 'TALENTO_HUMANO', jti: 'jti-th' };

const entradaBase: CrearUsuarioEntrada = {
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Perez',
  areaId: 1,
  cargoId: 1,
  rol: 'EMPLEADO',
  jefeInmediatoId: null,
  fechaIngreso: '2020-03-01',
};

function crearEscenario() {
  const memoria = crearUsuariosEnMemoria();
  const servicio = new UsuariosService({
    repositorio: memoria.repositorio,
    hashear: (clave) => Promise.resolve(`hash:${clave}`),
  });
  return { servicio, ...memoria };
}

// Crea personas con cedulas distintas a partir de la entrada base
function persona(numero: number, cambios: Partial<CrearUsuarioEntrada> = {}): CrearUsuarioEntrada {
  return { ...entradaBase, cedula: `01020304${String(numero).padStart(2, '0')}`, ...cambios };
}

describe('crear', () => {
  it('Talento Humano crea un empleado sin cuenta', async () => {
    const { servicio } = crearEscenario();
    const usuario = await servicio.crear(talento, entradaBase);
    expect(usuario).toMatchObject({ rol: 'EMPLEADO', estado: 'ACTIVO', tieneCuenta: false, correo: null });
  });

  it('crea una persona con cuenta y guarda la clave hasheada', async () => {
    const { servicio, claveGuardada } = crearEscenario();
    const usuario = await servicio.crear(
      superadmin,
      persona(1, { rol: 'JEFE_AREA', correo: 'jefe@hospital.test', clave: 'ClaveSegura-123' }),
    );
    expect(usuario.tieneCuenta).toBe(true);
    expect(claveGuardada(usuario.id)).toBe('hash:ClaveSegura-123');
  });

  it('Talento Humano no puede asignar SUPERADMIN ni TALENTO_HUMANO', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.crear(talento, persona(1, { rol: 'SUPERADMIN' }))).rejects.toMatchObject({
      codigo: 'PROHIBIDO',
    });
    await expect(servicio.crear(talento, persona(2, { rol: 'TALENTO_HUMANO' }))).rejects.toMatchObject({
      codigo: 'PROHIBIDO',
    });
  });

  it('rechaza una clave sin correo', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.crear(talento, persona(1, { clave: 'ClaveSegura-123' }))).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza una cedula repetida en el hospital pero la permite en otro', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(talento, entradaBase);
    await expect(servicio.crear(talento, entradaBase)).rejects.toMatchObject({ codigo: 'CONFLICTO' });
    await expect(
      servicio.crear({ ...talento, empresaId: 6 }, entradaBase),
    ).resolves.toBeDefined();
  });

  it('rechaza un correo repetido aunque sea de otro hospital', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(talento, persona(1, { correo: 'ana@hospital.test' }));
    await expect(
      servicio.crear({ ...talento, empresaId: 6 }, persona(2, { correo: 'ana@hospital.test' })),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza un jefe inmediato que no existe en el hospital', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.crear(talento, persona(1, { jefeInmediatoId: 9999 }))).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });
});

describe('obtener y listar', () => {
  it('no devuelve personas de otro hospital', async () => {
    const { servicio } = crearEscenario();
    const ajeno = await servicio.crear({ ...talento, empresaId: 6 }, entradaBase);
    await expect(servicio.obtener(5, ajeno.id)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('busca por palabras y pagina los resultados', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(talento, persona(1, { nombres: 'Ana', apellidos: 'Perez' }));
    await servicio.crear(talento, persona(2, { nombres: 'Luis', apellidos: 'Perez' }));
    await servicio.crear(talento, persona(3, { nombres: 'Rosa', apellidos: 'Gomez' }));

    const pagina = await servicio.listar(5, { busqueda: 'perez', pagina: 1, porPagina: 1 });
    expect(pagina).toMatchObject({ total: 2, pagina: 1, porPagina: 1 });
    expect(pagina.usuarios).toHaveLength(1);

    const exacta = await servicio.listar(5, { busqueda: 'perez luis', pagina: 1, porPagina: 20 });
    expect(exacta.usuarios.map((u) => u.nombres)).toEqual(['Luis']);
  });

  it('filtra por estado', async () => {
    const { servicio } = crearEscenario();
    const ana = await servicio.crear(talento, persona(1));
    await servicio.crear(talento, persona(2));
    await servicio.darDeBaja(talento, ana.id, undefined);

    const inactivos = await servicio.listar(5, { estado: 'INACTIVO', pagina: 1, porPagina: 20 });
    expect(inactivos.usuarios.map((u) => u.id)).toEqual([ana.id]);
  });
});

describe('actualizar', () => {
  it('cambia los campos indicados y conserva el resto', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    const usuario = await servicio.actualizar(talento, creada.id, { telefono: '0991234567' });
    expect(usuario).toMatchObject({ telefono: '0991234567', nombres: 'Ana', cedula: '0102030405' });
  });

  it('Talento Humano no puede editar a un SUPERADMIN', async () => {
    const { servicio } = crearEscenario();
    const admin = await servicio.crear(superadmin, persona(1, { rol: 'SUPERADMIN' }));
    await expect(servicio.actualizar(talento, admin.id, { nombres: 'Otro' })).rejects.toMatchObject({
      codigo: 'PROHIBIDO',
    });
  });

  it('un cambio de clave guarda el hash y cierra la sesion', async () => {
    const { servicio, claveGuardada, sesionesCerradas } = crearEscenario();
    const creada = await servicio.crear(talento, persona(1, { correo: 'ana@hospital.test' }));
    const usuario = await servicio.actualizar(talento, creada.id, { clave: 'NuevaClave-12345' });
    expect(usuario.tieneCuenta).toBe(true);
    expect(claveGuardada(creada.id)).toBe('hash:NuevaClave-12345');
    expect(sesionesCerradas).toContain(creada.id);
  });

  it('clave en null quita el acceso', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(
      talento,
      persona(1, { correo: 'ana@hospital.test', clave: 'ClaveSegura-123' }),
    );
    const usuario = await servicio.actualizar(talento, creada.id, { clave: null });
    expect(usuario.tieneCuenta).toBe(false);
  });

  it('no deja quitar el correo a quien tiene cuenta', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(
      talento,
      persona(1, { correo: 'ana@hospital.test', clave: 'ClaveSegura-123' }),
    );
    await expect(servicio.actualizar(talento, creada.id, { correo: null })).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('no deja a una persona como su propio jefe', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    await expect(
      servicio.actualizar(talento, creada.id, { jefeInmediatoId: creada.id }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('responde 404 si la persona no existe', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.actualizar(talento, 9999, { nombres: 'Otro' })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('baja y reactivacion', () => {
  it('da de baja con fecha de hoy por defecto y cierra la sesion', async () => {
    const { servicio, sesionesCerradas } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    const usuario = await servicio.darDeBaja(talento, creada.id, undefined);
    expect(usuario).toMatchObject({ estado: 'INACTIVO', fechaBaja: '2026-10-09' });
    expect(sesionesCerradas).toContain(creada.id);
  });

  it('usa la fecha de baja indicada', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    const usuario = await servicio.darDeBaja(talento, creada.id, '2026-10-01');
    expect(usuario.fechaBaja).toBe('2026-10-01');
  });

  it('nadie se da de baja a si mismo', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    await expect(
      servicio.darDeBaja({ ...talento, id: creada.id }, creada.id, undefined),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza una baja repetida', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    await servicio.darDeBaja(talento, creada.id, undefined);
    await expect(servicio.darDeBaja(talento, creada.id, undefined)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('Talento Humano no puede dar de baja a un SUPERADMIN', async () => {
    const { servicio } = crearEscenario();
    const admin = await servicio.crear(superadmin, persona(1, { rol: 'SUPERADMIN' }));
    await expect(servicio.darDeBaja(talento, admin.id, undefined)).rejects.toMatchObject({
      codigo: 'PROHIBIDO',
    });
  });

  it('reactiva a una persona dada de baja y limpia la fecha', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    await servicio.darDeBaja(talento, creada.id, undefined);
    const usuario = await servicio.reactivar(talento, creada.id);
    expect(usuario).toMatchObject({ estado: 'ACTIVO', fechaBaja: null });
  });

  it('rechaza reactivar a quien ya esta activo', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(talento, entradaBase);
    await expect(servicio.reactivar(talento, creada.id)).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });
});