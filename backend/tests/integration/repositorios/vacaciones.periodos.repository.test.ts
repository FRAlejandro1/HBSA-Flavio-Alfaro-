// Pruebas del repositorio de periodos contra MySQL real.
// Verifica la configuración individual, por área e institucional,
// el aislamiento por hospital y la creación idempotente de periodos.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { PeriodosRepository } from '../../../src/modules/vacaciones/vacaciones.periodos.repository';
import { PeriodosService } from '../../../src/modules/vacaciones/vacaciones.periodos.service';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new PeriodosRepository(bd);

const servicio = new PeriodosService({
  repositorio,
  obtenerDiasVacacionesAnuales: () => Promise.resolve(30),
});

const HOY = '2026-10-15';

// Crea una persona del hospital A con fecha de ingreso conocida.
async function crearPersona(): Promise<number> {
  const id = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0100000001',
  });

  await bd.ejecutar(
    `UPDATE usuarios
     SET fecha_ingreso = '2022-01-10',
         dias_vacaciones = NULL
     WHERE empresa_id = ? AND id = ?`,
    [IDS.empresaA, id],
  );

  await bd.ejecutar(
    `UPDATE areas
     SET dias_vacaciones = NULL
     WHERE empresa_id = ? AND id = ?`,
    [IDS.empresaA, IDS.areaA1],
  );

  return id;
}

// Configura los días de vacaciones del área de la persona.
async function configurarDiasArea(dias: number | null): Promise<void> {
  await bd.ejecutar(
    `UPDATE areas
     SET dias_vacaciones = ?
     WHERE empresa_id = ? AND id = ?`,
    [dias, IDS.empresaA, IDS.areaA1],
  );
}

// Configura los días de vacaciones individuales de la persona.
async function configurarDiasPersona(
  usuarioId: number,
  dias: number | null,
): Promise<void> {
  await bd.ejecutar(
    `UPDATE usuarios
     SET dias_vacaciones = ?
     WHERE empresa_id = ? AND id = ?`,
    [dias, IDS.empresaA, usuarioId],
  );
}

interface PeriodoEnBd {
  fechaInicio: string;
  fechaCaducidad: string;
  diasDerecho: number;
  diasUsados: number;
}

// Consulta los periodos de una persona para verificar sus valores persistidos.
async function periodosDe(usuarioId: number): Promise<PeriodoEnBd[]> {
  const filas = await bd.consultar<{
    fechaInicio: string;
    fechaCaducidad: string;
    diasDerecho: string | number;
    diasUsados: string | number;
  }>(
    `SELECT fecha_inicio AS fechaInicio, fecha_caducidad AS fechaCaducidad,
            dias_derecho AS diasDerecho, dias_usados AS diasUsados
     FROM periodos_vacaciones
     WHERE empresa_id = ? AND usuario_id = ?
     ORDER BY fecha_inicio`,
    [IDS.empresaA, usuarioId],
  );

  return filas.map((fila) => ({
    fechaInicio: fila.fechaInicio,
    fechaCaducidad: fila.fechaCaducidad,
    diasDerecho: Number.parseFloat(String(fila.diasDerecho)),
    diasUsados: Number.parseFloat(String(fila.diasUsados)),
  }));
}

beforeEach(async () => {
  await resetearDatos();
});

// Los periodos tienen una clave foránea a usuarios.
afterEach(async () => {
  await bd.ejecutar('DELETE FROM periodos_vacaciones');
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('datos de la persona', () => {
  it('devuelve la fecha de ingreso y las configuraciones individual y del área', async () => {
    const id = await crearPersona();

    await configurarDiasArea(35);
    await configurarDiasPersona(id, 40);

    expect(await repositorio.buscarDatosDePeriodos(IDS.empresaA, id)).toEqual({
      fechaIngreso: '2022-01-10',
      diasVacacionesPersona: 40,
      diasVacacionesArea: 35,
    });
  });

  it('devuelve null en las configuraciones cuando no existen excepciones', async () => {
    const id = await crearPersona();

    expect(await repositorio.buscarDatosDePeriodos(IDS.empresaA, id)).toEqual({
      fechaIngreso: '2022-01-10',
      diasVacacionesPersona: null,
      diasVacacionesArea: null,
    });
  });

  it('una persona de otro hospital no existe para este', async () => {
    const id = await crearPersona();

    expect(
      await repositorio.buscarDatosDePeriodos(IDS.empresaB, id),
    ).toBeNull();
  });
});

describe('crear periodos faltantes', () => {
  const periodo = {
    fechaInicio: '2026-01-10',
    fechaCaducidad: '2028-01-10',
  };

  it('crea el periodo y no modifica sus días ni los días usados si ya existe', async () => {
    const id = await crearPersona();

    await repositorio.crearPeriodosFaltantes(
      IDS.empresaA,
      id,
      [periodo],
      30,
    );

    await bd.ejecutar(
      'UPDATE periodos_vacaciones SET dias_usados = 5 WHERE usuario_id = ?',
      [id],
    );

    await repositorio.crearPeriodosFaltantes(
      IDS.empresaA,
      id,
      [periodo],
      40,
    );

    expect(await periodosDe(id)).toEqual([
      {
        ...periodo,
        diasDerecho: 30,
        diasUsados: 5,
      },
    ]);
  });

  it('dos llamadas concurrentes no duplican el periodo ni fallan', async () => {
    const id = await crearPersona();

    await Promise.all([
      repositorio.crearPeriodosFaltantes(
        IDS.empresaA,
        id,
        [periodo],
        30,
      ),
      repositorio.crearPeriodosFaltantes(
        IDS.empresaA,
        id,
        [periodo],
        30,
      ),
    ]);

    expect(await periodosDe(id)).toHaveLength(1);
  });
});

describe('asegurar los periodos', () => {
  it('utiliza los días de la configuración institucional cuando no hay excepciones', async () => {
    const id = await crearPersona();

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect(
      (await periodosDe(id)).map((periodo) => periodo.diasDerecho),
    ).toEqual([30, 30]);
  });

  it('utiliza los días configurados para el área cuando no hay excepción individual', async () => {
    const id = await crearPersona();
    await configurarDiasArea(35);

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect(
      (await periodosDe(id)).map((periodo) => periodo.diasDerecho),
    ).toEqual([35, 35]);
  });

  it('prioriza los días individuales sobre los del área y los institucionales', async () => {
    const id = await crearPersona();
    await configurarDiasArea(35);
    await configurarDiasPersona(id, 40);

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect(
      (await periodosDe(id)).map((periodo) => periodo.diasDerecho),
    ).toEqual([40, 40]);
  });

  it('llamarlo nuevamente no duplica los periodos existentes', async () => {
    const id = await crearPersona();

    await servicio.asegurar(IDS.empresaA, id, HOY);
    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect(await periodosDe(id)).toHaveLength(2);
  });

  it('no modifica los días de derecho de periodos que ya existen', async () => {
    const id = await crearPersona();

    await servicio.asegurar(IDS.empresaA, id, HOY);

    await bd.ejecutar(
      `UPDATE periodos_vacaciones
       SET dias_derecho = 25
       WHERE empresa_id = ? AND usuario_id = ?`,
      [IDS.empresaA, id],
    );

    await configurarDiasArea(35);

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect(
      (await periodosDe(id)).map((periodo) => periodo.diasDerecho),
    ).toEqual([25, 25]);
  });
});