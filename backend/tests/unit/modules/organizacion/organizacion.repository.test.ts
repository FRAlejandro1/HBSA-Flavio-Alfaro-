// Pruebas unitarias del repositorio de organizacion.
// Verifica consultas parametrizadas, conversiones, actualizaciones y traduccion de errores.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos, IConexionBD } from '../../../../src/config/database';
import { OrganizacionRepository } from '../../../../src/modules/organizacion/organizacion.repository';

const consultar = vi.fn();
const ejecutar = vi.fn();
const transaccion = vi.fn();

const bd = {
  consultar,
  ejecutar,
  transaccion,
} as unknown as IBaseDatos;

const repositorio = new OrganizacionRepository(bd);

const filaArea = {
  id: 10,
  detalle: 'Emergencia',
  parentId: null,
  procesoId: 2,
  diasVacaciones: '25.5',
  jefeId: 7,
  jefeNombres: 'Rosa',
  jefeApellidos: 'Mena',
};

const filaCargo = {
  id: 20,
  detalle: 'Medico',
  grado: null,
  rolPuesto: 'MEDICO',
  nivelJerarquico: 5,
  responsabilidad: 'Atencion',
  funciones: 'Atender pacientes',
};

const datosArea = {
  detalle: 'Laboratorio',
  jefeId: 7,
  parentId: null,
  procesoId: 2,
};

const datosCargo = {
  detalle: 'Enfermero',
  grado: 3,
  rolPuesto: 'ENFERMERIA',
  nivelJerarquico: 5,
  responsabilidad: 'Cuidados',
  funciones: 'Atender pacientes',
};

beforeEach(() => {
  vi.clearAllMocks();

  consultar.mockResolvedValue([]);
  ejecutar.mockResolvedValue({ filasAfectadas: 1, idInsertado: 99 });

  transaccion.mockImplementation(
    async (trabajo: (conexion: IConexionBD) => Promise<unknown>) =>
      trabajo({ consultar, ejecutar }),
  );
});

describe('listarProcesos', () => {
  it('consulta el catalogo global de procesos sin filtro de hospital', async () => {
    const procesos = [{ id: 1, codigo: 'GOB', detalle: 'Gobernante' }];
    consultar.mockResolvedValueOnce(procesos);

    await expect(repositorio.listarProcesos()).resolves.toEqual(procesos);
    expect(consultar).toHaveBeenCalledWith(
      'SELECT id, codigo, detalle FROM procesos ORDER BY id',
      [],
    );
  });
});

describe('listarAreas', () => {
  it('lista areas del hospital y convierte sus campos y jefe', async () => {
    consultar.mockResolvedValueOnce([
      filaArea,
      {
        ...filaArea,
        id: 11,
        detalle: 'Consulta Externa',
        diasVacaciones: null,
        jefeId: null,
        jefeNombres: null,
        jefeApellidos: null,
      },
      {
        ...filaArea,
        id: 12,
        jefeNombres: null,
      },
    ]);

    const resultado = await repositorio.listarAreas(3);

    expect(consultar).toHaveBeenCalledWith(
      expect.stringContaining('WHERE a.empresa_id = ? ORDER BY a.detalle'),
      [3],
    );
    expect(resultado[0]).toEqual({
      id: 10,
      detalle: 'Emergencia',
      jefe: { id: 7, nombres: 'Rosa', apellidos: 'Mena' },
      parentId: null,
      procesoId: 2,
      diasVacaciones: 25.5,
    });
    expect(resultado[1]).toMatchObject({
      id: 11,
      jefe: null,
      diasVacaciones: null,
    });
    expect(resultado[2]?.jefe).toBeNull();
  });

  it('devuelve una lista vacia cuando no existen areas', async () => {
    await expect(repositorio.listarAreas(3)).resolves.toEqual([]);
  });
});

describe('buscarArea', () => {
  it('busca por empresa e identificador y convierte la fila', async () => {
    consultar.mockResolvedValueOnce([filaArea]);

    await expect(repositorio.buscarArea(3, 10)).resolves.toMatchObject({
      id: 10,
      jefe: { id: 7, nombres: 'Rosa', apellidos: 'Mena' },
      diasVacaciones: 25.5,
    });

    expect(consultar).toHaveBeenCalledWith(
      expect.stringContaining('AND a.id = ? LIMIT 1'),
      [3, 10],
    );
  });

  it('devuelve null cuando el area no existe en el hospital', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.buscarArea(3, 999)).resolves.toBeNull();
  });
});

describe('crearArea', () => {
  it('inserta el area con todos sus datos parametrizados y devuelve el id', async () => {
    await expect(repositorio.crearArea(3, datosArea)).resolves.toBe(99);

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO areas'),
      [3, 2, null, 'Laboratorio', 7],
    );
  });

  it('traduce un error de nombre duplicado', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(repositorio.crearArea(3, datosArea)).rejects.toThrow(
      'Ya existe un area con ese nombre',
    );
  });

  it('traduce una referencia invalida', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.crearArea(3, datosArea)).rejects.toThrow(
      'El jefe, el area padre o el proceso indicado no existe en este hospital',
    );
  });
});

describe('actualizarArea', () => {
  it('actualiza todos los campos permitidos en una sola sentencia', async () => {
    await repositorio.actualizarArea(3, 10, {
      detalle: 'Urgencias',
      jefeId: null,
      parentId: 5,
    });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE areas SET detalle = ?, jefe_id = ?, parent_id = ?'),
      ['Urgencias', null, 5, 3, 10],
    );
  });

  it('actualiza solamente el nombre cuando es el unico campo recibido', async () => {
    await repositorio.actualizarArea(3, 10, { detalle: 'Urgencias' });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE areas SET detalle = ?'),
      ['Urgencias', 3, 10],
    );
  });

  it('actualiza solamente el jefe y permite quitarlo con null', async () => {
    await repositorio.actualizarArea(3, 10, { jefeId: null });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('jefe_id = ?'),
      [null, 3, 10],
    );
  });

  it('actualiza solamente el area padre y permite establecer null', async () => {
    await repositorio.actualizarArea(3, 10, { parentId: null });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('parent_id = ?'),
      [null, 3, 10],
    );
  });

  it('no ejecuta SQL cuando no hay campos para actualizar', async () => {
    await expect(repositorio.actualizarArea(3, 10, {})).resolves.toBeUndefined();

    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('traduce los errores de actualizacion', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(
      repositorio.actualizarArea(3, 10, { detalle: 'Emergencia' }),
    ).rejects.toThrow('Ya existe un area con ese nombre');
  });
});

describe('configurarDiasVacacionesArea', () => {
  it('actualiza los dias y registra la auditoria dentro de una transaccion', async () => {
    consultar
      .mockResolvedValueOnce([{ diasVacaciones: '20' }])
      .mockResolvedValueOnce([{ diasVacaciones: '25.5' }]);

    await expect(
      repositorio.configurarDiasVacacionesArea(3, 8, 10, 25.5),
    ).resolves.toBe(25.5);

    expect(transaccion).toHaveBeenCalledOnce();
    expect(consultar).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      [3, 10],
    );
    expect(ejecutar).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE areas SET dias_vacaciones = ?'),
      [25.5, 3, 10],
    );

    expect(ejecutar).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO audit_log'),
      [
        3,
        8,
        'ACTUALIZACION_DIAS_VACACIONES_AREA',
        'AREA',
        10,
        JSON.stringify({ antes: 20, despues: 25.5 }),
      ],
    );
  });

  it('registra el valor anterior null y permite restablecer la herencia institucional', async () => {
    consultar
      .mockResolvedValueOnce([{ diasVacaciones: null }])
      .mockResolvedValueOnce([{ diasVacaciones: null }]);

    await expect(
      repositorio.configurarDiasVacacionesArea(3, 8, 10, null),
    ).resolves.toBeNull();

    expect(ejecutar).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([
        JSON.stringify({ antes: null, despues: null }),
      ]),
    );
  });

  it('devuelve null si la consulta posterior no devuelve una fila', async () => {
    consultar
      .mockResolvedValueOnce([{ diasVacaciones: 20 }])
      .mockResolvedValueOnce([]);

    await expect(
      repositorio.configurarDiasVacacionesArea(3, 8, 10, 25),
    ).resolves.toBeNull();
  });

  it('lanza AREA_NO_ENCONTRADA si el area no existe', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.configurarDiasVacacionesArea(3, 8, 999, 25),
    ).rejects.toThrow('AREA_NO_ENCONTRADA');

    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('traduce los errores de base de datos de la transaccion', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(
      repositorio.configurarDiasVacacionesArea(3, 8, 10, 25),
    ).rejects.toThrow('El area indicada no existe en este hospital');
  });

  it('propaga sin traducir el error AREA_NO_ENCONTRADA', async () => {
    consultar.mockResolvedValueOnce([]);

    let errorCapturado: unknown;

    try {
      await repositorio.configurarDiasVacacionesArea(3, 8, 999, 25);
    } catch (error) {
      errorCapturado = error;
    }

    expect(errorCapturado).toBeInstanceOf(Error);
    expect((errorCapturado as Error).message).toBe('AREA_NO_ENCONTRADA');
  });
});

describe('eliminarArea', () => {
  it('devuelve true cuando elimina una fila', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.eliminarArea(3, 10)).resolves.toBe(true);
    expect(ejecutar).toHaveBeenCalledWith(
      'DELETE FROM areas WHERE empresa_id = ? AND id = ?',
      [3, 10],
    );
  });

  it('devuelve false cuando no elimina ninguna fila', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 0, idInsertado: 0 });

    await expect(repositorio.eliminarArea(3, 10)).resolves.toBe(false);
  });

  it('traduce el error de integridad cuando el area esta en uso', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_ROW_IS_REFERENCED_2' });

    await expect(repositorio.eliminarArea(3, 10)).rejects.toThrow(
      'El area tiene personal, subareas o solicitudes asignados y no se puede eliminar',
    );
  });
});

describe('listarCargos', () => {
  it('consulta los cargos del hospital ordenados por detalle', async () => {
    consultar.mockResolvedValueOnce([filaCargo]);

    await expect(repositorio.listarCargos(3)).resolves.toEqual([filaCargo]);

    expect(consultar).toHaveBeenCalledWith(
      expect.stringContaining('FROM cargos WHERE empresa_id = ? ORDER BY detalle'),
      [3],
    );
  });

  it('devuelve una lista vacia cuando no existen cargos', async () => {
    await expect(repositorio.listarCargos(3)).resolves.toEqual([]);
  });
});

describe('buscarCargo', () => {
  it('devuelve el cargo encontrado', async () => {
    consultar.mockResolvedValueOnce([filaCargo]);

    await expect(repositorio.buscarCargo(3, 20)).resolves.toEqual(filaCargo);

    expect(consultar).toHaveBeenCalledWith(
      expect.stringContaining('WHERE empresa_id = ? AND id = ? LIMIT 1'),
      [3, 20],
    );
  });

  it('devuelve null cuando el cargo no existe', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.buscarCargo(3, 999)).resolves.toBeNull();
  });
});

describe('crearCargo', () => {
  it('inserta todos los campos y devuelve el id generado', async () => {
    await expect(repositorio.crearCargo(3, datosCargo)).resolves.toBe(99);

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cargos'),
      [3, 'Enfermero', 3, 'ENFERMERIA', 5, 'Cuidados', 'Atender pacientes'],
    );
  });

  it('traduce el error de cargo duplicado', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(repositorio.crearCargo(3, datosCargo)).rejects.toThrow(
      'Ya existe un cargo con ese nombre',
    );
  });
});

describe('actualizarCargo', () => {
  it('actualiza todos los campos permitidos', async () => {
    await repositorio.actualizarCargo(3, 20, {
      detalle: 'Enfermero especialista',
      grado: 4,
      rolPuesto: 'ENFERMERIA_ESPECIALISTA',
      nivelJerarquico: 4,
      responsabilidad: 'Supervision',
      funciones: 'Coordinar',
    });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE cargos SET detalle = ?, grado = ?, rol_puesto = ?, nivel_jerarquico = ?, responsabilidad = ?, funciones = ?',
      ),
      [
        'Enfermero especialista',
        4,
        'ENFERMERIA_ESPECIALISTA',
        4,
        'Supervision',
        'Coordinar',
        3,
        20,
      ],
    );
  });

  it('actualiza un unico campo y conserva los demas fuera del SQL', async () => {
    await repositorio.actualizarCargo(3, 20, { funciones: 'Coordinar' });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE cargos SET funciones = ?'),
      ['Coordinar', 3, 20],
    );
  });

  it('permite establecer valores null en campos opcionales', async () => {
    await repositorio.actualizarCargo(3, 20, {
      grado: null,
      rolPuesto: null,
    });

    expect(ejecutar).toHaveBeenCalledWith(
      expect.stringContaining('grado = ?, rol_puesto = ?'),
      [null, null, 3, 20],
    );
  });

  it('no ejecuta SQL cuando no hay cambios', async () => {
    await expect(repositorio.actualizarCargo(3, 20, {})).resolves.toBeUndefined();

    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('traduce los errores de actualizacion', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(
      repositorio.actualizarCargo(3, 20, { detalle: 'Medico' }),
    ).rejects.toThrow('Ya existe un cargo con ese nombre');
  });
});

describe('eliminarCargo', () => {
  it('devuelve true cuando elimina un cargo', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.eliminarCargo(3, 20)).resolves.toBe(true);
    expect(ejecutar).toHaveBeenCalledWith(
      'DELETE FROM cargos WHERE empresa_id = ? AND id = ?',
      [3, 20],
    );
  });

  it('devuelve false cuando el cargo no existe', async () => {
    ejecutar.mockResolvedValueOnce({ filasAfectadas: 0, idInsertado: 0 });

    await expect(repositorio.eliminarCargo(3, 20)).resolves.toBe(false);
  });

  it('traduce el error de integridad cuando el cargo esta en uso', async () => {
    ejecutar.mockRejectedValueOnce({ code: 'ER_ROW_IS_REFERENCED_2' });

    await expect(repositorio.eliminarCargo(3, 20)).rejects.toThrow(
      'El cargo esta asignado a personal o a solicitudes y no se puede eliminar',
    );
  });
});