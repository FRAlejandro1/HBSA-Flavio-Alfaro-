// Pruebas unitarias del repositorio de importacion.
// Verifica catalogos, aislamiento por empresa, mapeo de usuarios y aplicacion transaccional.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos, IConexionBD } from '../../../../src/config/database';
import { ImportacionRepository } from '../../../../src/modules/importacion/importacion.repository';
import type { PlanAplicacion } from '../../../../src/modules/importacion/importacion.dominio';

const consultar = vi.fn();
const ejecutar = vi.fn();
const transaccion = vi.fn();

const consultarTx = vi.fn();
const ejecutarTx = vi.fn();

const tx = {
  consultar: consultarTx,
  ejecutar: ejecutarTx,
} as unknown as IConexionBD;

const bd = {
  consultar,
  ejecutar,
  transaccion,
} as unknown as IBaseDatos;

const repositorio = new ImportacionRepository(bd);

const filaUsuario = {
  id: 10,
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@hospital.test',
  telefono: '0991234567',
  areaId: 2,
  cargoId: 3,
  rol: 'EMPLEADO',
  jefeCedula: '0100000000',
  fechaIngreso: '2020-01-15',
  estado: 'ACTIVO' as const,
  fechaBaja: null,
};

const planVacio: PlanAplicacion = {
  crear: [],
  actualizar: [],
  jefes: [],
  bajas: [],
};

const planCompleto: PlanAplicacion = {
  crear: [
    {
      cedula: '0100000001',
      nombres: 'Luis',
      apellidos: 'Mena',
      correo: 'luis@hospital.test',
      telefono: '0991111111',
      areaId: 2,
      cargoId: 3,
      rol: 'JEFE_AREA',
      fechaIngreso: '2021-02-01',
    },
    {
      cedula: '0100000002',
      nombres: 'María',
      apellidos: 'López',
      correo: null,
      telefono: null,
      areaId: 4,
      cargoId: 5,
      rol: 'EMPLEADO',
      fechaIngreso: '2022-03-01',
    },
  ],
  actualizar: [
    {
      id: 10,
      cedula: '0102030405',
      cambios: {
        nombres: 'Ana María',
        apellidos: 'Pérez López',
        correo: 'ana.nueva@hospital.test',
        telefono: '0980000000',
        areaId: 4,
        cargoId: 6,
        fechaIngreso: '2020-02-01',
        rol: 'JEFE_AREA',
      },
      cerrarSesion: true,
    },
    {
      id: 11,
      cedula: '0102030406',
      cambios: {},
      cerrarSesion: false,
    },
  ],
  jefes: [
    { cedula: '0102030405', cedulaJefe: '0100000001' },
  ],
  bajas: [
    { id: 12, fechaBaja: '2026-01-15' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  transaccion.mockImplementation(
    (trabajo: (conexion: IConexionBD) => Promise<unknown>) => trabajo(tx),
  );
  ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 1 });
});

describe('listarAreas', () => {
  it('consulta las áreas del hospital indicado', async () => {
    const areas = [
      { id: 1, detalle: 'Emergencia' },
      { id: 2, detalle: 'Hospitalización' },
    ];
    consultar.mockResolvedValueOnce(areas);

    await expect(repositorio.listarAreas(7)).resolves.toEqual(areas);

    expect(consultar).toHaveBeenCalledOnce();
    expect(consultar.mock.calls[0]?.[0]).toBe(
      'SELECT id, detalle FROM areas WHERE empresa_id = ?',
    );
    expect(consultar.mock.calls[0]?.[1]).toEqual([7]);
  });

  it('devuelve una lista vacía cuando no existen áreas', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.listarAreas(7)).resolves.toEqual([]);
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo al listar áreas'));

    await expect(repositorio.listarAreas(7)).rejects.toThrow(
      'Fallo al listar áreas',
    );
  });
});

describe('listarCargos', () => {
  it('consulta los cargos del hospital indicado', async () => {
    const cargos = [{ id: 3, detalle: 'Enfermera' }];
    consultar.mockResolvedValueOnce(cargos);

    await expect(repositorio.listarCargos(7)).resolves.toEqual(cargos);

    expect(consultar).toHaveBeenCalledOnce();
    expect(consultar.mock.calls[0]?.[0]).toBe(
      'SELECT id, detalle FROM cargos WHERE empresa_id = ?',
    );
    expect(consultar.mock.calls[0]?.[1]).toEqual([7]);
  });

  it('devuelve una lista vacía cuando no existen cargos', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.listarCargos(7)).resolves.toEqual([]);
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo al listar cargos'));

    await expect(repositorio.listarCargos(7)).rejects.toThrow(
      'Fallo al listar cargos',
    );
  });
});

describe('listarUsuarios', () => {
  it('consulta usuarios del hospital y convierte el rol', async () => {
    consultar.mockResolvedValueOnce([filaUsuario]);

    const resultado = await repositorio.listarUsuarios(7);

    expect(resultado).toEqual([
      { ...filaUsuario, rol: 'EMPLEADO' },
    ]);
    expect(consultar).toHaveBeenCalledOnce();
    expect(consultar.mock.calls[0]?.[0]).toContain(
      'WHERE u.empresa_id = ?',
    );
    expect(consultar.mock.calls[0]?.[0]).toContain(
      'j.empresa_id = u.empresa_id AND j.id = u.jefe_inmediato_id',
    );
    expect(consultar.mock.calls[0]?.[1]).toEqual([7]);
  });

  it('devuelve una lista vacía cuando no hay usuarios', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.listarUsuarios(7)).resolves.toEqual([]);
  });

  it('conserva los campos opcionales nulos', async () => {
    consultar.mockResolvedValueOnce([
      {
        ...filaUsuario,
        correo: null,
        telefono: null,
        jefeCedula: null,
        fechaBaja: null,
      },
    ]);

    const resultado = await repositorio.listarUsuarios(7);

    expect(resultado[0]).toMatchObject({
      correo: null,
      telefono: null,
      jefeCedula: null,
      fechaBaja: null,
    });
  });

  it('rechaza un código de rol desconocido', async () => {
    consultar.mockResolvedValueOnce([
      { ...filaUsuario, rol: 'ROL_INVALIDO' },
    ]);

    await expect(repositorio.listarUsuarios(7)).rejects.toThrow();
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo al consultar usuarios'));

    await expect(repositorio.listarUsuarios(7)).rejects.toThrow(
      'Fallo al consultar usuarios',
    );
  });
});

describe('aplicar', () => {
  it('aplica creación, actualización, asignación de jefes y bajas en una transacción', async () => {
    await expect(repositorio.aplicar(7, planCompleto)).resolves.toBeUndefined();

    expect(transaccion).toHaveBeenCalledOnce();
    expect(ejecutarTx).toHaveBeenCalledTimes(5);

    const llamadas = ejecutarTx.mock.calls;

    expect(llamadas[0]?.[0]).toContain('INSERT INTO usuarios');
    expect(llamadas[0]?.[0]).toContain(
      '(SELECT id FROM roles WHERE codigo = ?)',
    );
    expect(llamadas[0]?.[1]).toEqual([
      7, 2, 3, 'JEFE_AREA', '0100000001', 'Luis', 'Mena',
      'luis@hospital.test', '0991111111', '2021-02-01',
    ]);

    expect(llamadas[1]?.[1]).toEqual([
      7, 4, 5, 'EMPLEADO', '0100000002', 'María', 'López',
      null, null, '2022-03-01',
    ]);

    expect(llamadas[2]?.[0]).toContain('UPDATE usuarios SET');
    expect(llamadas[2]?.[0]).toContain('nombres = ?');
    expect(llamadas[2]?.[0]).toContain('apellidos = ?');
    expect(llamadas[2]?.[0]).toContain('email = ?');
    expect(llamadas[2]?.[0]).toContain('telefono = ?');
    expect(llamadas[2]?.[0]).toContain('area_id = ?');
    expect(llamadas[2]?.[0]).toContain('cargo_id = ?');
    expect(llamadas[2]?.[0]).toContain('fecha_ingreso = ?');
    expect(llamadas[2]?.[0]).toContain('rol_id = (SELECT id FROM roles WHERE codigo = ?)');
    expect(llamadas[2]?.[0]).toContain('token_id = NULL');
    expect(llamadas[2]?.[1]).toEqual([
      'Ana María',
      'Pérez López',
      'ana.nueva@hospital.test',
      '0980000000',
      4,
      6,
      '2020-02-01',
      'JEFE_AREA',
      7,
      10,
    ]);

    expect(llamadas[3]?.[0]).toContain('UPDATE usuarios u');
    expect(llamadas[3]?.[0]).toContain(
      'jefe.empresa_id = u.empresa_id AND jefe.cedula = ?',
    );
    expect(llamadas[3]?.[1]).toEqual([
      '0100000001',
      7,
      '0102030405',
    ]);

    expect(llamadas[4]?.[0]).toContain("estado = 'INACTIVO'");
    expect(llamadas[4]?.[0]).toContain('fecha_baja = ?');
    expect(llamadas[4]?.[0]).toContain('token_id = NULL');
    expect(llamadas[4]?.[1]).toEqual(['2026-01-15', 7, 12]);

  });

  it('no ejecuta actualizaciones cuando no hay campos modificados', async () => {
    const plan: PlanAplicacion = {
      crear: [],
      actualizar: [
        {
          id: 10,
          cedula: '0102030405',
          cambios: {},
          cerrarSesion: false,
        },
      ],
      jefes: [],
      bajas: [],
    };

    await repositorio.aplicar(7, plan);

    expect(transaccion).toHaveBeenCalledOnce();
    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('actualiza solo los campos definidos y no invalida la sesión si no se solicita', async () => {
    const plan: PlanAplicacion = {
      crear: [],
      actualizar: [
        {
          id: 10,
          cedula: '0102030405',
          cambios: { nombres: 'Ana actualizada' },
          cerrarSesion: false,
        },
      ],
      jefes: [],
      bajas: [],
    };

    await repositorio.aplicar(7, plan);

    expect(ejecutarTx).toHaveBeenCalledOnce();
    expect(ejecutarTx.mock.calls[0]?.[0]).toContain('nombres = ?');
    expect(ejecutarTx.mock.calls[0]?.[0]).not.toContain('token_id = NULL');
    expect(ejecutarTx.mock.calls[0]?.[1]).toEqual([
      'Ana actualizada',
      7,
      10,
    ]);
  });

  it('invalida la sesión aunque no existan otros campos modificados', async () => {
    const plan: PlanAplicacion = {
      crear: [],
      actualizar: [
        {
          id: 10,
          cedula: '0102030405',
          cambios: {},
          cerrarSesion: true,
        },
      ],
      jefes: [],
      bajas: [],
    };

    await repositorio.aplicar(7, plan);

    expect(ejecutarTx).toHaveBeenCalledOnce();
    expect(ejecutarTx.mock.calls[0]?.[0]).toContain('token_id = NULL');
    expect(ejecutarTx.mock.calls[0]?.[1]).toEqual([7, 10]);
  });

  it('permite aplicar un plan vacío dentro de una transacción', async () => {
    await expect(repositorio.aplicar(7, planVacio)).resolves.toBeUndefined();

    expect(transaccion).toHaveBeenCalledOnce();
    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('ejecuta solo la etapa de creación cuando el plan solo contiene personas nuevas', async () => {
    const plan: PlanAplicacion = {
      crear: [planCompleto.crear[0]!],
      actualizar: [],
      jefes: [],
      bajas: [],
    };

    await repositorio.aplicar(7, plan);

    expect(ejecutarTx).toHaveBeenCalledOnce();
    expect(ejecutarTx.mock.calls[0]?.[0]).toContain('INSERT INTO usuarios');
  });

  it('ejecuta solo la etapa de asignación de jefes cuando corresponde', async () => {
    const plan: PlanAplicacion = {
      crear: [],
      actualizar: [],
      jefes: [{ cedula: '0102030405', cedulaJefe: '0100000001' }],
      bajas: [],
    };

    await repositorio.aplicar(7, plan);

    expect(ejecutarTx).toHaveBeenCalledOnce();
    expect(ejecutarTx.mock.calls[0]?.[0]).toContain('UPDATE usuarios u');
  });

  it('ejecuta solo la etapa de bajas cuando corresponde', async () => {
    const plan: PlanAplicacion = {
      crear: [],
      actualizar: [],
      jefes: [],
      bajas: [{ id: 10, fechaBaja: '2026-01-15' }],
    };

    await repositorio.aplicar(7, plan);

    expect(ejecutarTx).toHaveBeenCalledOnce();
    expect(ejecutarTx.mock.calls[0]?.[0]).toContain("estado = 'INACTIVO'");
  });

  it('traduce errores de duplicidad de la transacción', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Una cédula o un correo del archivo ya existe en el sistema',
    });
  });

  it('traduce referencias inválidas de la transacción', async () => {
    transaccion.mockRejectedValueOnce({
      code: 'ER_NO_REFERENCED_ROW_2',
    });

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'Un área, cargo o jefe del archivo no existe en este hospital',
    });
  });

  it('traduce conflictos por registros relacionados', async () => {
    transaccion.mockRejectedValueOnce({
      code: 'ER_ROW_IS_REFERENCED_2',
    });

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('propaga errores inesperados de la transacción', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo de importación'));

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toThrow('Fallo de importación');
  });

  it('convierte valores de error no estándar en Error', async () => {
    transaccion.mockRejectedValueOnce('error no estándar');

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toThrow('error no estándar');
  });

  it('mantiene la transacción única si falla una operación intermedia', async () => {
    ejecutarTx
      .mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 1 })
      .mockRejectedValueOnce(new Error('Fallo en la segunda inserción'));

    await expect(
      repositorio.aplicar(7, planCompleto),
    ).rejects.toThrow('Fallo en la segunda inserción');

    expect(transaccion).toHaveBeenCalledOnce();
    expect(ejecutarTx).toHaveBeenCalledTimes(2);
  });
});
