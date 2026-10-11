// Pruebas del esquema contra MySQL real: horas en UTC, fechas de calendario sin conversion,
// columna "tipo" derivada de la fecha de la solicitud y bitacora que no se puede modificar.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../../src/config/database';
import { IDS, insertarUsuario, resetearDatos } from '../../helpers/baseDatos';

const bd = obtenerBaseDatos();
let contador = 0;

// Inserta una solicitud de vacaciones minima y devuelve su id
async function insertarSolicitud(
  usuarioId: number,
  solicitadoAt: string,
  fechaSolicitud: string,
  fechaInicio: string,
): Promise<number> {
  contador += 1;
  const resultado = await bd.ejecutar(
    `INSERT INTO solicitudes_vacaciones
       (empresa_id, orden_tramite, usuario_id, area_id, cargo_id, lugar,
        solicitado_at, fecha_solicitud, fecha_inicio, fecha_fin, dias_solicitados)
     VALUES (?, ?, ?, ?, ?, 'Ciudad A', ?, ?, ?, ?, 1)`,
    [
      IDS.empresaA,
      `VAC-PRUEBA-${contador}`,
      usuarioId,
      IDS.areaA1,
      IDS.cargoA1,
      solicitadoAt,
      fechaSolicitud,
      fechaInicio,
      fechaInicio,
    ],
  );
  return resultado.idInsertado;
}

async function tipoDe(id: number): Promise<string | undefined> {
  const [fila] = await bd.consultar<{ tipo: string }>(
    'SELECT tipo FROM solicitudes_vacaciones WHERE id = ?',
    [id],
  );
  return fila?.tipo;
}

let usuarioId = 0;

beforeEach(async () => {
  await resetearDatos();
  usuarioId = await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0100000001',
  });
});

afterAll(async () => {
  await cerrarBaseDatos();
});

describe('horas en UTC', () => {
  it('la sesion de la base trabaja en UTC', async () => {
    const [fila] = await bd.consultar<{ iguales: number }>('SELECT (NOW() = UTC_TIMESTAMP()) AS iguales');
    expect(Number(fila?.iguales)).toBe(1);
  });

  it('los instantes llegan como Date en UTC y las fechas de calendario como texto', async () => {
    const id = await insertarSolicitud(usuarioId, '2026-10-10 03:00:00', '2026-10-09', '2026-10-16');
    const [fila] = await bd.consultar<{ solicitadoAt: Date; fechaSolicitud: string; fechaInicio: string }>(
      `SELECT solicitado_at AS solicitadoAt, fecha_solicitud AS fechaSolicitud, fecha_inicio AS fechaInicio
       FROM solicitudes_vacaciones WHERE id = ?`,
      [id],
    );
    expect(fila?.solicitadoAt).toBeInstanceOf(Date);
    expect(fila?.solicitadoAt.toISOString()).toBe('2026-10-10T03:00:00.000Z');
    expect(fila?.fechaSolicitud).toBe('2026-10-09');
    expect(fila?.fechaInicio).toBe('2026-10-16');
  });
});

describe('tipo de solicitud', () => {
  it('es programada con 7 dias de calendario aunque en UTC la hora ya sea del dia siguiente', async () => {
    // 22:00 del 9 de octubre en Ecuador = 03:00 del 10 en UTC; la fecha de calendario es el 9
    const id = await insertarSolicitud(usuarioId, '2026-10-10 03:00:00', '2026-10-09', '2026-10-16');
    expect(await tipoDe(id)).toBe('PROGRAMADA');
  });

  it('no es programada con menos de 7 dias', async () => {
    const id = await insertarSolicitud(usuarioId, '2026-10-10 03:00:00', '2026-10-09', '2026-10-15');
    expect(await tipoDe(id)).toBe('NO_PROGRAMADA');
  });
});

describe('bitacora de auditoria', () => {
  it('rechaza modificar y borrar registros', async () => {
    await bd.ejecutar("INSERT INTO audit_log (empresa_id, accion, entidad) VALUES (?, 'PRUEBA', 'prueba')", [
      IDS.empresaA,
    ]);
    await expect(bd.ejecutar("UPDATE audit_log SET accion = 'CAMBIO'")).rejects.toThrow(
      'audit_log es de solo insercion',
    );
    await expect(bd.ejecutar('DELETE FROM audit_log')).rejects.toThrow('audit_log es de solo insercion');
  });
});