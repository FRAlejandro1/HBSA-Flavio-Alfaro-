// Pruebas del repositorio de periodos contra MySQL real: arbol de areas, periodos que no se repiten y bitacora de cambios.
// Corre con npm run test:db. Parte de los datos base de las pruebas (IDS) y deja la tabla de periodos limpia al terminar.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { PeriodosRepository } from '../../../src/modules/vacaciones/vacaciones.periodos.repository';
import { PeriodosService } from '../../../src/modules/vacaciones/vacaciones.periodos.service';
import type { UsuarioAutenticado } from '../../../src/shared/types/autenticacion';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
const repositorio = new PeriodosRepository(bd);
const servicio = new PeriodosService({ repositorio, diasPorDefecto: 30 });

const HOY = '2026-10-15';

// Quien cambia los dias: la bitacora guarda su id, que no necesita existir como persona
const superadmin: UsuarioAutenticado = {
  id: 9001,
  empresaId: IDS.empresaA,
  rol: 'SUPERADMIN',
  jti: 'jti-9001',
  expira: 9_999_999_999,
};

// Persona del hospital A que entro el 10 de enero de 2022 (area A1)
async function crearPersona(): Promise<number> {
  const id = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0100000001',
  });
  await bd.ejecutar("UPDATE usuarios SET fecha_ingreso = '2022-01-10' WHERE id = ?", [id]);
  return id;
}

interface PeriodoEnBd {
  fechaInicio: string;
  fechaCaducidad: string;
  diasDerecho: number;
  diasUsados: number;
}

async function periodosDe(usuarioId: number): Promise<PeriodoEnBd[]> {
  const filas = await bd.consultar<{
    fechaInicio: string;
    fechaCaducidad: string;
    diasDerecho: string | number;
    diasUsados: string | number;
  }>(
    `SELECT fecha_inicio AS fechaInicio, fecha_caducidad AS fechaCaducidad,
            dias_derecho AS diasDerecho, dias_usados AS diasUsados
     FROM periodos_vacaciones WHERE empresa_id = ? AND usuario_id = ? ORDER BY fecha_inicio`,
    [IDS.empresaA, usuarioId],
  );
  return filas.map((fila) => ({
    fechaInicio: fila.fechaInicio,
    fechaCaducidad: fila.fechaCaducidad,
    diasDerecho: Number.parseFloat(String(fila.diasDerecho)),
    diasUsados: Number.parseFloat(String(fila.diasUsados)),
  }));
}

async function diasDeArea(areaId: number): Promise<number | null> {
  const [fila] = await bd.consultar<{ dias: string | number | null }>(
    'SELECT dias_vacaciones AS dias FROM areas WHERE id = ?',
    [areaId],
  );
  return fila?.dias === null || fila?.dias === undefined ? null : Number.parseFloat(String(fila.dias));
}

async function contarConstancias(empresaId: number, entidad: 'areas' | 'usuarios', entidadId: number): Promise<number> {
  const [fila] = await bd.consultar<{ total: number }>(
    'SELECT COUNT(*) AS total FROM audit_log WHERE empresa_id = ? AND entidad = ? AND entidad_id = ?',
    [empresaId, entidad, entidadId],
  );
  return Number.parseFloat(String(fila?.total ?? 0));
}

// La ultima constancia de un cambio: quien lo hizo y de cuanto a cuanto
async function ultimaConstancia(entidad: 'areas' | 'usuarios', entidadId: number) {
  const [fila] = await bd.consultar<{ accion: string; actorId: number; detalle: unknown }>(
    `SELECT accion, usuario_id AS actorId, detalle FROM audit_log
     WHERE empresa_id = ? AND entidad = ? AND entidad_id = ? ORDER BY id DESC LIMIT 1`,
    [IDS.empresaA, entidad, entidadId],
  );
  if (!fila) {
    return null;
  }
  // Segun el controlador, el JSON llega ya convertido o como texto
  const detalle: unknown = typeof fila.detalle === 'string' ? JSON.parse(fila.detalle) : fila.detalle;
  return { accion: fila.accion, actorId: fila.actorId, detalle };
}

beforeEach(async () => {
  await resetearDatos();
});

// La tabla de periodos tiene clave foranea a usuarios: se vacia antes del siguiente reinicio de datos
afterEach(async () => {
  await bd.ejecutar('DELETE FROM periodos_vacaciones');
  await bd.ejecutar("DELETE FROM areas WHERE detalle = 'Subarea de prueba'");
  await bd.ejecutar('UPDATE areas SET parent_id = NULL, dias_vacaciones = NULL');
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('cadena de areas', () => {
  it('sube por el arbol hasta la raiz, con los dias de cada nivel', async () => {
    await bd.ejecutar('UPDATE areas SET parent_id = ? WHERE id = ?', [IDS.areaA2, IDS.areaA1]);
    await bd.ejecutar('UPDATE areas SET dias_vacaciones = 40 WHERE id = ?', [IDS.areaA2]);
    const subarea = await bd.ejecutar(
      "INSERT INTO areas (empresa_id, detalle, parent_id) VALUES (?, 'Subarea de prueba', ?)",
      [IDS.empresaA, IDS.areaA1],
    );

    const cadena = await repositorio.listarDiasDeCadenaDeAreas(IDS.empresaA, subarea.idInsertado);

    expect(cadena).toEqual([
      { nivel: 0, diasVacaciones: null },
      { nivel: 1, diasVacaciones: null },
      { nivel: 2, diasVacaciones: 40 },
    ]);
  });

  it('un area sin padre devuelve solo ella', async () => {
    await bd.ejecutar('UPDATE areas SET dias_vacaciones = 35 WHERE id = ?', [IDS.areaA1]);
    expect(await repositorio.listarDiasDeCadenaDeAreas(IDS.empresaA, IDS.areaA1)).toEqual([
      { nivel: 0, diasVacaciones: 35 },
    ]);
  });

  it('un area de otro hospital no existe para este', async () => {
    expect(await repositorio.listarDiasDeCadenaDeAreas(IDS.empresaA, IDS.areaB1)).toEqual([]);
  });
});

describe('datos de la persona', () => {
  it('devuelve su area, su fecha de ingreso como texto y sus dias propios', async () => {
    const id = await crearPersona();
    expect(await repositorio.buscarDatosDePeriodos(IDS.empresaA, id)).toEqual({
      areaId: IDS.areaA1,
      fechaIngreso: '2022-01-10',
      diasVacaciones: null,
    });

    await bd.ejecutar('UPDATE usuarios SET dias_vacaciones = 28 WHERE id = ?', [id]);
    expect((await repositorio.buscarDatosDePeriodos(IDS.empresaA, id))?.diasVacaciones).toBe(28);
  });

  it('una persona de otro hospital no existe para este', async () => {
    const id = await crearPersona();
    expect(await repositorio.buscarDatosDePeriodos(IDS.empresaB, id)).toBeNull();
  });
});

describe('crear periodos faltantes', () => {
  const periodo = { fechaInicio: '2026-01-10', fechaCaducidad: '2028-01-10' };

  it('crea el periodo y, si ya existe, no cambia ni los dias ni lo usado', async () => {
    const id = await crearPersona();
    await repositorio.crearPeriodosFaltantes(IDS.empresaA, id, [periodo], 30);
    await bd.ejecutar('UPDATE periodos_vacaciones SET dias_usados = 5 WHERE usuario_id = ?', [id]);

    await repositorio.crearPeriodosFaltantes(IDS.empresaA, id, [periodo], 40);

    expect(await periodosDe(id)).toEqual([{ ...periodo, diasDerecho: 30, diasUsados: 5 }]);
  });

  it('dos llamadas a la vez no repiten el periodo ni fallan', async () => {
    const id = await crearPersona();
    await Promise.all([
      repositorio.crearPeriodosFaltantes(IDS.empresaA, id, [periodo], 30),
      repositorio.crearPeriodosFaltantes(IDS.empresaA, id, [periodo], 30),
    ]);
    expect(await periodosDe(id)).toHaveLength(1);
  });
});

describe('asegurar los periodos', () => {
  it('crea los periodos vigentes con los dias por defecto', async () => {
    const id = await crearPersona();
    await servicio.asegurar(IDS.empresaA, id, HOY);
    expect(await periodosDe(id)).toEqual([
      { fechaInicio: '2025-01-10', fechaCaducidad: '2027-01-10', diasDerecho: 30, diasUsados: 0 },
      { fechaInicio: '2026-01-10', fechaCaducidad: '2028-01-10', diasDerecho: 30, diasUsados: 0 },
    ]);
  });

  it('usa los dias del area y, si no los hay, los del area padre', async () => {
    const id = await crearPersona();
    await bd.ejecutar('UPDATE areas SET parent_id = ? WHERE id = ?', [IDS.areaA2, IDS.areaA1]);
    await bd.ejecutar('UPDATE areas SET dias_vacaciones = 40 WHERE id = ?', [IDS.areaA2]);

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect((await periodosDe(id)).map((p) => p.diasDerecho)).toEqual([40, 40]);
  });

  it('los dias de la persona mandan sobre los del area', async () => {
    const id = await crearPersona();
    await bd.ejecutar('UPDATE areas SET dias_vacaciones = 35 WHERE id = ?', [IDS.areaA1]);
    await bd.ejecutar('UPDATE usuarios SET dias_vacaciones = 28 WHERE id = ?', [id]);

    await servicio.asegurar(IDS.empresaA, id, HOY);

    expect((await periodosDe(id)).map((p) => p.diasDerecho)).toEqual([28, 28]);
  });

  it('llamarlo otra vez no repite periodos', async () => {
    const id = await crearPersona();
    await servicio.asegurar(IDS.empresaA, id, HOY);
    await servicio.asegurar(IDS.empresaA, id, HOY);
    expect(await periodosDe(id)).toHaveLength(2);
  });
});

describe('fijar los dias', () => {
  it('de un area: queda guardado, deja constancia y null lo quita', async () => {
    const fijada = await servicio.fijarDeArea(superadmin, IDS.areaA1, 35);
    expect(fijada).toEqual({ diasVacaciones: 35, diasEfectivos: 35, origen: 'PROPIO' });
    expect(await diasDeArea(IDS.areaA1)).toBe(35);
    expect(await ultimaConstancia('areas', IDS.areaA1)).toEqual({
      accion: 'CAMBIO_DIAS_VACACIONES',
      actorId: 9001,
      detalle: { antes: null, despues: 35 },
    });

    const quitada = await servicio.fijarDeArea(superadmin, IDS.areaA1, null);
    expect(quitada).toEqual({ diasVacaciones: null, diasEfectivos: 30, origen: 'PREDETERMINADO' });
    expect(await diasDeArea(IDS.areaA1)).toBeNull();
    expect((await ultimaConstancia('areas', IDS.areaA1))?.detalle).toEqual({ antes: 35, despues: null });
  });

  it('de una persona: queda guardado y deja constancia', async () => {
    const id = await crearPersona();
    const fijada = await servicio.fijarDePersona(superadmin, id, 28);
    expect(fijada).toEqual({ diasVacaciones: 28, diasEfectivos: 28, origen: 'PROPIO' });
    expect((await ultimaConstancia('usuarios', id))?.detalle).toEqual({ antes: null, despues: 28 });
  });

  it('un cambio no toca los periodos que ya existen', async () => {
    const id = await crearPersona();
    await servicio.asegurar(IDS.empresaA, id, HOY);
    await servicio.fijarDeArea(superadmin, IDS.areaA1, 35);
    expect((await periodosDe(id)).map((p) => p.diasDerecho)).toEqual([30, 30]);
  });

  it('un area de otro hospital no cambia ni deja constancia', async () => {
    const antes = await contarConstancias(IDS.empresaB, 'areas', IDS.areaB1);
    await expect(servicio.fijarDeArea(superadmin, IDS.areaB1, 35)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    expect(await diasDeArea(IDS.areaB1)).toBeNull();
    expect(await contarConstancias(IDS.empresaB, 'areas', IDS.areaB1)).toBe(antes);
  });
});