// Pruebas unitarias del repositorio de usuarios.
// Verifica consultas parametrizadas, aislamiento por empresa, conversiones y transacciones.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos, IConexionBD } from '../../../../src/config/database';
import { UsuariosRepository } from '../../../../src/modules/usuarios/usuarios.repository';
import type { DatosNuevoUsuario } from '../../../../src/modules/usuarios/usuarios.dominio';

const consultar = vi.fn<IConexionBD['consultar']>();
const ejecutar = vi.fn<IConexionBD['ejecutar']>();
const transaccion = vi.fn<IBaseDatos['transaccion']>();

const bd = { consultar, ejecutar, transaccion } as unknown as IBaseDatos;
const repositorio = new UsuariosRepository(bd);

const consultarTx = vi.fn<IConexionBD['consultar']>();
const ejecutarTx = vi.fn<IConexionBD['ejecutar']>();
const tx = {
  consultar: consultarTx,
  ejecutar: ejecutarTx,
} as unknown as IConexionBD;
function obtenerLlamada<T extends readonly unknown[]>(
  llamadas: readonly T[],
  indice: number,
): T {
  const llamada = llamadas[indice];

  if (llamada === undefined) {
    throw new Error(`No existe la llamada al mock en la posición ${indice}`);
  }

  return llamada;
}

const usuarioFila = {
  id: 10,
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@hospital.test',
  telefono: '0991234567',
  rol: 'EMPLEADO',
  areaId: 2,
  areaDetalle: 'Emergencia',
  cargoId: 3,
  cargoDetalle: 'Enfermera',
  jefeId: 5,
  jefeNombres: 'Luis',
  jefeApellidos: 'Mena',
  fechaIngreso: '2020-01-15',
  estado: 'ACTIVO' as const,
  fechaBaja: null,
  tieneCuenta: 1,
};

const datosNuevoUsuario: DatosNuevoUsuario = {
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@hospital.test',
  telefono: '0991234567',
  areaId: 2,
  cargoId: 3,
  rol: 'EMPLEADO',
  jefeInmediatoId: 5,
  fechaIngreso: '2020-01-15',
  passwordHash: 'hash-seguro',
};

beforeEach(() => {
  vi.clearAllMocks();
  transaccion.mockImplementation(
    (trabajo: (conexion: IConexionBD) => Promise<unknown>) => trabajo(tx),
  );
});

describe('buscar', () => {
  it('lista usuarios y convierte el resultado del conteo', async () => {
    consultar
      .mockResolvedValueOnce([usuarioFila])
      .mockResolvedValueOnce([{ total: '12' }]);

    const resultado = await repositorio.buscar(7, { pagina: 1, porPagina: 10 });

    expect(resultado.total).toBe(12);
    expect(resultado.usuarios).toHaveLength(1);
    expect(resultado.usuarios[0]).toMatchObject({
      id: 10,
      cedula: '0102030405',
      rol: 'EMPLEADO',
      area: { id: 2, detalle: 'Emergencia' },
      cargo: { id: 3, detalle: 'Enfermera' },
      jefeInmediato: { id: 5, nombres: 'Luis', apellidos: 'Mena' },
      tieneCuenta: true,
    });
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7]);
    expect(obtenerLlamada(consultar.mock.calls, 1)[1]).toEqual([7]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 10 OFFSET 0');
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('WHERE u.empresa_id = ?');
  });

  it('devuelve lista vacía y total cero cuando no hay resultados', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      repositorio.buscar(7, { pagina: 1, porPagina: 20 }),
    ).resolves.toEqual({ usuarios: [], total: 0 });
  });

  it('aplica desplazamiento según página y tamaño', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 25 }]);

    await repositorio.buscar(7, { pagina: 3, porPagina: 10 });

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 10 OFFSET 20');
  });

  it('combina búsqueda, área y estado con parámetros', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, {
      busqueda: 'Ana',
      areaId: 2,
      estado: 'ACTIVO',
      pagina: 1,
      porPagina: 10,
    });

    const [sql, valores] = obtenerLlamada(consultar.mock.calls, 0);
    expect(sql).toContain('u.cedula LIKE ?');
    expect(sql).toContain('u.area_id = ?');
    expect(sql).toContain('u.estado = ?');
    expect(valores).toEqual([7, 'Ana%', 'Ana%', 'Ana%', 'Ana%', 2, 'ACTIVO']);
    expect(obtenerLlamada(consultar.mock.calls, 1)[1]).toEqual(valores);
  });

  it('separa términos de búsqueda y genera cuatro parámetros por término', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, {
      busqueda: 'Ana  Pérez',
      pagina: 1,
      porPagina: 10,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([
      7,
      'Ana%', 'Ana%', 'Ana%', 'Ana%',
      'Pérez%', 'Pérez%', 'Pérez%', 'Pérez%',
    ]);
  });

  it('limita la búsqueda a cinco términos', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, {
      busqueda: 'uno dos tres cuatro cinco seis',
      pagina: 1,
      porPagina: 10,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toHaveLength(21);
  });

  it('escapa los comodines y la barra invertida en la búsqueda', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, {
      busqueda: String.raw`A%_\B`,
      pagina: 1,
      porPagina: 10,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([
      7,
      String.raw`A\%\_\\B%`,
      String.raw`A\%\_\\B%`,
      String.raw`A\%\_\\B%`,
      String.raw`A\%\_\\B%`,
    ]);
  });

  it('ignora términos vacíos de la búsqueda', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, {
      busqueda: '   ',
      pagina: 1,
      porPagina: 10,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).not.toContain('LIKE');
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7]);
  });

  it('trunca los valores de paginación antes de construir LIMIT y OFFSET', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.buscar(7, { pagina: 2.9, porPagina: 5.8 });

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 5 OFFSET 5');
  });

  it('convierte el indicador de cuenta cuando llega como número distinto de uno', async () => {
    consultar.mockResolvedValueOnce([{ ...usuarioFila, tieneCuenta: 0 }])
      .mockResolvedValueOnce([{ total: 1 }]);

    const resultado = await repositorio.buscar(7, { pagina: 1, porPagina: 10 });

    expect(resultado.usuarios[0]?.tieneCuenta).toBe(false);
  });

  it('representa un jefe incompleto como null', async () => {
    consultar.mockResolvedValueOnce([
      { ...usuarioFila, jefeId: 5, jefeNombres: null, jefeApellidos: 'Mena' },
    ]).mockResolvedValueOnce([{ total: 1 }]);

    const resultado = await repositorio.buscar(7, { pagina: 1, porPagina: 10 });

    expect(resultado.usuarios[0]?.jefeInmediato).toBeNull();
  });

  it('representa la ausencia de jefe y conserva correo, teléfono y fecha de baja nulos', async () => {
    consultar.mockResolvedValueOnce([
      {
        ...usuarioFila,
        correo: null,
        telefono: null,
        jefeId: null,
        jefeNombres: null,
        jefeApellidos: null,
        fechaBaja: '2025-02-01',
      },
    ]).mockResolvedValueOnce([{ total: 1 }]);

    const resultado = await repositorio.buscar(7, { pagina: 1, porPagina: 10 });

    expect(resultado.usuarios[0]).toMatchObject({
      correo: null,
      telefono: null,
      jefeInmediato: null,
      fechaBaja: '2025-02-01',
    });
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo de consulta'));

    await expect(
      repositorio.buscar(7, { pagina: 1, porPagina: 10 }),
    ).rejects.toThrow('Fallo de consulta');
  });
});

describe('obtener', () => {
  it('devuelve el usuario encontrado', async () => {
    consultar.mockResolvedValueOnce([usuarioFila]);

    await expect(repositorio.obtener(7, 10)).resolves.toMatchObject({
      id: 10,
      nombres: 'Ana',
      rol: 'EMPLEADO',
      tieneCuenta: true,
    });
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('u.empresa_id = ? AND u.id = ?');
  });

  it('devuelve null cuando el usuario no existe en el hospital', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.obtener(7, 99)).resolves.toBeNull();
  });

  it('rechaza un rol desconocido al convertir el usuario', async () => {
    consultar.mockResolvedValueOnce([{ ...usuarioFila, rol: 'ROL_INVALIDO' }]);

    await expect(repositorio.obtener(7, 10)).rejects.toThrow();
  });
});

describe('crear', () => {
  it('inserta el usuario con todos los parámetros y devuelve su identificador', async () => {
    ejecutar.mockResolvedValueOnce({ idInsertado: 41, filasAfectadas: 1 });

    await expect(repositorio.crear(7, datosNuevoUsuario)).resolves.toBe(41);

    expect(ejecutar).toHaveBeenCalledOnce();
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('INSERT INTO usuarios');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('SELECT id FROM roles WHERE codigo = ?');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual([
      7, 2, 3, 'EMPLEADO', 5, '0102030405', 'Ana', 'Pérez',
      'ana@hospital.test', '0991234567', 'hash-seguro', '2020-01-15',
    ]);
  });

  it('permite crear una persona sin correo, teléfono, jefe ni contraseña', async () => {
    ejecutar.mockResolvedValueOnce({ idInsertado: 42, filasAfectadas: 1 });

    await repositorio.crear(7, {
      ...datosNuevoUsuario,
      correo: null,
      telefono: null,
      jefeInmediatoId: null,
      passwordHash: null,
    });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toContain(null);
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toHaveLength(12);
  });

  it('traduce errores de duplicidad al crear', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(repositorio.crear(7, datosNuevoUsuario)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Ya existe una persona con esa cedula o ese correo',
    });
  });

  it('traduce referencias inválidas al crear', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.crear(7, datosNuevoUsuario)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'El area, el cargo o el jefe inmediato indicado no existe en este hospital',
    });
  });

  it('propaga errores no reconocidos al crear', async () => {
    ejecutar.mockRejectedValueOnce(new Error('Error inesperado'));

    await expect(repositorio.crear(7, datosNuevoUsuario)).rejects.toThrow(
      'Error inesperado',
    );
  });
});

describe('actualizar', () => {
  it('actualiza los campos de texto y relaciones con parámetros', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.actualizar(7, 10, {
      cedula: '0100000000',
      nombres: 'María',
      apellidos: 'López',
      correo: 'maria@hospital.test',
      telefono: '0980000000',
      areaId: 4,
      cargoId: 6,
      jefeInmediatoId: null,
      fechaIngreso: '2021-03-10',
      passwordHash: null,
    });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('cedula = ?');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('jefe_inmediato_id = ?');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('password_hash = ?');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual([
      '0100000000', 'María', 'López', 'maria@hospital.test',
      '0980000000', 4, 6, null, '2021-03-10', null, 7, 10,
    ]);
  });

  it('actualiza el rol mediante la subconsulta de roles', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.actualizar(7, 10, { rol: 'JEFE_AREA' });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain(
      'rol_id = (SELECT id FROM roles WHERE codigo = ?)',
    );
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual(['JEFE_AREA', 7, 10]);
  });

  it('invalida el token cuando se solicita cerrar la sesión', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.actualizar(7, 10, { cerrarSesion: true });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('token_id = NULL');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual([7, 10]);
  });

  it('combina cambios de rol y cierre de sesión', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.actualizar(7, 10, {
      nombres: 'Ana María',
      rol: 'JEFE_AREA',
      cerrarSesion: true,
    });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('nombres = ?');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('rol_id =');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('token_id = NULL');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual(['Ana María', 'JEFE_AREA', 7, 10]);
  });

  it('no ejecuta SQL cuando no hay cambios definidos', async () => {
    await repositorio.actualizar(7, 10, {});

    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('no cierra la sesión cuando cerrarSesion es false', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.actualizar(7, 10, {
      nombres: 'Ana',
      cerrarSesion: false,
    });

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).not.toContain('token_id = NULL');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual(['Ana', 7, 10]);
  });

  it('traduce errores de duplicidad al actualizar', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(
      repositorio.actualizar(7, 10, { cedula: 'duplicada' }),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('traduce referencias inválidas al actualizar', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(
      repositorio.actualizar(7, 10, { areaId: 999 }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });
});

describe('configurarDiasVacaciones', () => {
  it('actualiza los días, registra auditoría y devuelve el valor numérico', async () => {
    consultarTx
      .mockResolvedValueOnce([{ diasVacaciones: '30.5' }])
      .mockResolvedValueOnce([{ diasVacaciones: '25.5' }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25.5),
    ).resolves.toBe(25.5);

    expect(transaccion).toHaveBeenCalledOnce();
    expect(obtenerLlamada(consultarTx.mock.calls, 0)[0]).toContain('FOR UPDATE');
    expect(obtenerLlamada(consultarTx.mock.calls, 0)[1]).toEqual([7, 10]);
    expect(ejecutarTx).toHaveBeenCalledTimes(2);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([25.5, 7, 10]);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 1)[1]).toEqual([
      7,
      2,
      10,
      JSON.stringify({ antes: 30.5, despues: 25.5 }),
    ]);
    expect(obtenerLlamada(consultarTx.mock.calls, 1)[1]).toEqual([7, 10]);
  });

  it('permite restablecer la herencia mediante null y registra el valor anterior', async () => {
    consultarTx
      .mockResolvedValueOnce([{ diasVacaciones: 25 }])
      .mockResolvedValueOnce([{ diasVacaciones: null }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, null),
    ).resolves.toBeNull();

    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([null, 7, 10]);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 1)[1]?.[3]).toBe(
      JSON.stringify({ antes: 25, despues: null }),
    );
  });

  it('conserva null cuando el valor anterior también era null', async () => {
    consultarTx
      .mockResolvedValueOnce([{ diasVacaciones: null }])
      .mockResolvedValueOnce([{ diasVacaciones: null }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, null),
    ).resolves.toBeNull();

    expect(obtenerLlamada(ejecutarTx.mock.calls, 1)[1]?.[3]).toBe(
      JSON.stringify({ antes: null, despues: null }),
    );
  });

  it('rechaza una persona inexistente antes de actualizar o auditar', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 99, 25),
    ).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      message: 'La persona indicada no existe en este hospital',
    });

    expect(ejecutarTx).not.toHaveBeenCalled();
    expect(consultarTx).toHaveBeenCalledOnce();
  });

  it('rechaza si no puede recuperar la configuración después de actualizar', async () => {
    consultarTx
      .mockResolvedValueOnce([{ diasVacaciones: 30 }])
      .mockResolvedValueOnce([]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25),
    ).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      message: 'No se pudo recuperar la configuración de vacaciones del empleado',
    });
  });

  it('traduce referencias inválidas durante la transacción', async () => {
    consultarTx.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25),
    ).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'La persona indicada no existe en este hospital',
    });
  });

  it('propaga errores inesperados de la transacción', async () => {
    consultarTx.mockRejectedValueOnce(new Error('Fallo transaccional'));

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25),
    ).rejects.toThrow('Fallo transaccional');
  });

  it('propaga errores durante la actualización transaccional', async () => {
    consultarTx.mockResolvedValueOnce([{ diasVacaciones: 30 }]);
    ejecutarTx.mockRejectedValueOnce(new Error('Fallo al actualizar'));

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25),
    ).rejects.toThrow('Fallo al actualizar');
  });

  it('propaga errores al insertar la auditoría', async () => {
    consultarTx.mockResolvedValueOnce([{ diasVacaciones: 30 }]);
    ejecutarTx
      .mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 })
      .mockRejectedValueOnce(new Error('Fallo de auditoría'));

    await expect(
      repositorio.configurarDiasVacaciones(7, 2, 10, 25),
    ).rejects.toThrow('Fallo de auditoría');
  });
});

describe('darDeBaja', () => {
  it('registra la fecha de baja explícita y elimina el token', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.darDeBaja(7, 10, '2026-01-15');

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain("estado = 'INACTIVO'");
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('COALESCE(?, CURDATE())');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('token_id = NULL');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual(['2026-01-15', 7, 10]);
  });

  it('usa CURDATE cuando la fecha de baja es null', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.darDeBaja(7, 10, null);

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual([null, 7, 10]);
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('CURDATE()');
  });

  it('propaga errores de base de datos', async () => {
    ejecutar.mockRejectedValueOnce(new Error('Fallo al dar de baja'));

    await expect(repositorio.darDeBaja(7, 10, null)).rejects.toThrow(
      'Fallo al dar de baja',
    );
  });
});

describe('reactivar', () => {
  it('activa al usuario y elimina su fecha de baja', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.reactivar(7, 10);

    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain("estado = 'ACTIVO'");
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[0]).toContain('fecha_baja = NULL');
    expect(obtenerLlamada(ejecutar.mock.calls, 0)[1]).toEqual([7, 10]);
  });

  it('propaga errores de base de datos', async () => {
    ejecutar.mockRejectedValueOnce(new Error('Fallo al reactivar'));

    await expect(repositorio.reactivar(7, 10)).rejects.toThrow(
      'Fallo al reactivar',
    );
  });
});
