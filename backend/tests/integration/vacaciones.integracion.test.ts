// Prueba del repository y el service de vacaciones contra MySQL real con los seeds (002 a 004 y test/001).
// Antes de empezar recrea el esquema y los seeds desde cero: otras suites de base real (organizacion, e2e)
// vacian las tablas con resetearDatos y se llevan los seeds que esta necesita.
// Solo corre contra una base cuyo nombre termina en _test.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createConnection } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarBaseDatos, obtenerBaseDatos } from '../../src/config/database';
import { env } from '../../src/config/env';
import { VacacionesRepository } from '../../src/modules/vacaciones/vacaciones.repository';
import type { DatosNuevaSolicitud } from '../../src/modules/vacaciones/vacaciones.dominio';
import { VacacionesService } from '../../src/modules/vacaciones/vacaciones.service';
import { dividirSentencias, ejecutarMigracion } from '../../src/scripts/migrador';
import type { UsuarioAutenticado } from '../../src/shared/types/autenticacion';
import { calcularDiasLaborables } from '../../src/shared/utils/fechas';
import { conexionPruebas } from '../setup/entornoDb';

const AHORA = new Date('2026-10-15T15:00:00Z');
const bd = obtenerBaseDatos();
const repositorio = new VacacionesRepository(bd);
const servicio = new VacacionesService({
  repositorio,
  calcularDiasLaborables,
  plazoAprobacionHoras: 1,
  ahora: () => AHORA,
});

// Carpeta database del repositorio: migraciones, seeds y los datos de prueba que el migrador no carga
const DIRECTORIO_SQL = path.resolve(__dirname, '../../../database');
const RUTA_DATOS_PRUEBA = path.join(DIRECTORIO_SQL, 'seeds/test/001_datos_prueba.sql');

const programada = { fechaInicio: '2026-11-02', fechaFin: '2026-11-06' };

// Los DECIMAL llegan como texto desde mysql2
function aNumero(valor: string | number | null): number {
  return Number.parseFloat(String(valor ?? 0));
}

// Persona del seed por cedula, convertida en el usuario autenticado de su hospital
async function actorDe(cedula: string, empresaId = 1): Promise<UsuarioAutenticado> {
  const [fila] = await bd.consultar<{ id: number; rol: UsuarioAutenticado['rol'] }>(
    'SELECT u.id AS id, r.codigo AS rol FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.empresa_id = ? AND u.cedula = ?',
    [empresaId, cedula],
  );
  if (!fila) throw new Error(`No existe ${cedula}`);
  return { id: fila.id, empresaId, rol: fila.rol, jti: 'jti', expira: 9_999_999_999 };
}

// Esta suite borra y recrea tablas: se niega a seguir si la base conectada no es de pruebas
async function exigirBaseDePruebas(): Promise<void> {
  const [fila] = await bd.consultar<{ nombre: string | null }>('SELECT DATABASE() AS nombre');
  const nombre = fila?.nombre ?? '';
  if (!nombre.endsWith('_test')) {
    throw new Error(`Esta suite solo corre contra una base _test (conectada: ${nombre || 'ninguna'})`);
  }
}

// Esquema y seeds base desde cero, como los deja globalSetupDb; el migrador tambien exige una base _test
async function reconstruirBase(): Promise<void> {
  await ejecutarMigracion({
    conexion: conexionPruebas,
    directorioSql: DIRECTORIO_SQL,
    modo: 'todo',
    incluirDemo: false,
    reiniciar: true,
  });
}

// Carga el personal, los periodos y los feriados de prueba (el seed no es idempotente: se corre sobre una base recien recreada)
async function cargarDatosDePrueba(): Promise<void> {
  // Conexion propia: el seed usa variables de sesion, que el pool repartiria entre conexiones
  const conexion = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
    timezone: '-05:00',
  });
  try {
    const contenido = await readFile(RUTA_DATOS_PRUEBA, 'utf8');
    for (const sentencia of dividirSentencias(contenido)) {
      await conexion.query(sentencia);
    }
  } finally {
    await conexion.end();
  }
}

// Borra las solicitudes de una persona (con sus pasos) para que una prueba parta de cero
async function limpiarSolicitudesDe(usuarioId: number): Promise<void> {
  await bd.ejecutar(
    `DELETE FROM solicitud_aprobaciones WHERE empresa_id = 1 AND solicitud_id IN
       (SELECT id FROM solicitudes_vacaciones WHERE empresa_id = 1 AND usuario_id = ?)`,
    [usuarioId],
  );
  await bd.ejecutar('DELETE FROM solicitudes_vacaciones WHERE empresa_id = 1 AND usuario_id = ?', [usuarioId]);
}

beforeAll(async () => {
  await exigirBaseDePruebas();
  await reconstruirBase();
  await cargarDatosDePrueba();
});
afterAll(async () => {
  await cerrarBaseDatos();
});

describe('crear contra MySQL', () => {
  it('Luis solicita a Laura: numero, tipo derivado, dias laborables, paso y vencimiento', async () => {
    const luis = await actorDe('0900000007');
    const solicitud = await servicio.crear(luis, programada);
    expect(solicitud).toMatchObject({
      ordenTramite: 'VAC-2026-000001',
      tipo: 'PROGRAMADA',
      estado: 'PENDIENTE',
      diasSolicitados: 3,
      fechaSolicitud: '2026-10-15',
      lugar: 'Flavio Alfaro',
      telefonoLocalizacion: '0990000007',
    });
    expect(solicitud.solicitante).toMatchObject({ nombres: 'Luis', cedula: '0900000007' });
    expect(solicitud.pasos).toHaveLength(1);
    expect(solicitud.pasos[0]).toMatchObject({
      tipoAprobador: 'JEFE_INMEDIATO',
      estado: 'PENDIENTE',
      aprobadorDisponible: true,
    });
    expect(solicitud.pasos[0]?.aprobador.nombres).toBe('Laura');
    expect(solicitud.pasos[0]?.venceAt).toEqual(new Date('2026-10-15T16:00:00Z'));
    expect(solicitud.solicitadoAt).toEqual(AHORA);
  });

  it('una solicitud con pocos dias de anticipacion queda NO_PROGRAMADA con su justificacion', async () => {
    const lucia = await actorDe('0900000008');
    const solicitud = await servicio.crear(lucia, {
      fechaInicio: '2026-10-19',
      fechaFin: '2026-10-20',
      justificacion: 'Tramite personal',
    });
    expect(solicitud).toMatchObject({ tipo: 'NO_PROGRAMADA', ordenTramite: 'VAC-2026-000002', diasSolicitados: 2 });
  });

  it('rechaza el cruce de fechas de la misma persona', async () => {
    const luis = await actorDe('0900000007');
    await expect(servicio.crear(luis, { fechaInicio: '2026-11-04', fechaFin: '2026-11-09' })).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('el subdirector va al Director y el Director al SUPERADMIN', async () => {
    const silvia = await actorDe('0900000003');
    const deSilvia = await servicio.crear(silvia, programada);
    expect(deSilvia.pasos[0]).toMatchObject({ tipoAprobador: 'AUTORIDAD_MAXIMA' });
    expect(deSilvia.pasos[0]?.aprobador.nombres).toBe('Diego');

    const diego = await actorDe('0900000002');
    const deDiego = await servicio.crear(diego, programada);
    expect(deDiego.pasos[0]).toMatchObject({ tipoAprobador: 'SUPERADMIN' });
    expect(deDiego.pasos[0]?.aprobador.nombres).toBe('Sara');
  });

  it('Pablo no tiene jefe inmediato: se rechaza con un mensaje claro', async () => {
    const pablo = await actorDe('0900000013');
    await expect(servicio.crear(pablo, programada)).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('Ivan, dado de baja, no puede solicitar', async () => {
    const ivan = await actorDe('0900000014');
    await expect(servicio.crear(ivan, programada)).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('si la jefa tiene vacaciones autorizadas hoy, el paso sale como no disponible', async () => {
    const laura = await actorDe('0900000006');
    await bd.ejecutar(
      `INSERT INTO solicitudes_vacaciones
         (empresa_id, orden_tramite, usuario_id, area_id, cargo_id, lugar, solicitado_at, fecha_solicitud,
          fecha_inicio, fecha_fin, dias_solicitados, estado)
       SELECT 1, 'VAC-2026-900001', u.id, u.area_id, u.cargo_id, 'Flavio Alfaro', '2026-10-01 15:00:00', '2026-10-01',
              '2026-10-14', '2026-10-16', 3, 'AUTORIZADA' FROM usuarios u WHERE u.id = ?`,
      [laura.id],
    );
    const ernesto = await actorDe('0900000010');
    const enfermero = await servicio.crear(ernesto, programada); // su jefa es Nora, disponible
    expect(enfermero.pasos[0]?.aprobadorDisponible).toBe(true);

    const lucia = await actorDe('0900000008'); // su jefa Laura esta ausente
    const solicitud = await servicio.crear(lucia, { fechaInicio: '2026-12-07', fechaFin: '2026-12-08' });
    expect(solicitud.pasos[0]).toMatchObject({ aprobadorDisponible: false, estado: 'PENDIENTE' });
  });

  it('cinco solicitudes en paralelo reciben numeros de tramite distintos y sin huecos', async () => {
    const cedulas = ['0900000009', '0900000011', '0900000012', '0900000005', '0900000004'];
    const antes = await bd.consultar<{ ultimo: number }>(
      'SELECT ultimo FROM secuencias_tramite WHERE empresa_id = 1 AND anio = 2026',
    );
    const base = antes[0]?.ultimo ?? 0;
    const actores = await Promise.all(cedulas.map((c) => actorDe(c)));
    const creadas = await Promise.all(
      actores.map((a, i) =>
        servicio.crear(a, { fechaInicio: `2027-03-${String(1 + i * 7).padStart(2, '0')}`, fechaFin: `2027-03-${String(1 + i * 7).padStart(2, '0')}` }),
      ),
    );
    const numeros = creadas.map((s) => Number.parseFloat(s.ordenTramite.slice(-6))).sort((a, b) => a - b);
    expect(numeros).toEqual([base + 1, base + 2, base + 3, base + 4, base + 5]);
  });
});

describe('carrera al registrar contra MySQL', () => {
  // Fecha de la solicitud y vigencia del periodo de estas pruebas, lejos de las demas
  const FECHA_SOLICITUD = '2026-10-15';

  // Deja a la persona con un unico periodo vigente de 2028 y el saldo indicado
  async function dejarSaldo(usuarioId: number, dias: number): Promise<void> {
    await bd.ejecutar('DELETE FROM periodos_vacaciones WHERE empresa_id = 1 AND usuario_id = ?', [usuarioId]);
    await bd.ejecutar(
      `INSERT INTO periodos_vacaciones (empresa_id, usuario_id, fecha_inicio, fecha_caducidad, dias_derecho, dias_usados)
       VALUES (1, ?, '2028-01-01', '2029-12-31', ?, 0)`,
      [usuarioId, dias],
    );
  }

  // Datos listos para registrarSolicitud, sin pasar por las comprobaciones previas del service
  async function datosDe(cedula: string, fechaInicio: string, fechaFin: string, dias: number) {
    const actor = await actorDe(cedula);
    const solicitante = await repositorio.buscarSolicitante(1, actor.id);
    if (!solicitante) throw new Error(`No existe ${cedula}`);
    const [tipoAprobador] = await repositorio.listarRuta(1, solicitante.nivelJerarquico);
    if (!tipoAprobador) throw new Error(`Sin ruta para ${cedula}`);
    const aprobadorId = await repositorio.resolverAprobador(1, tipoAprobador, solicitante);
    if (aprobadorId === null) throw new Error(`Sin aprobador para ${cedula}`);
    const datos: DatosNuevaSolicitud = {
      usuarioId: actor.id,
      areaId: solicitante.areaId,
      cargoId: solicitante.cargoId,
      lugar: solicitante.lugar,
      telefonoLocalizacion: null,
      solicitadoAt: AHORA,
      fechaSolicitud: FECHA_SOLICITUD,
      fechaInicio,
      fechaFin,
      diasSolicitados: dias,
      justificacion: null,
      primerPaso: {
        tipoAprobador,
        aprobadorId,
        asignadoAt: AHORA,
        venceAt: new Date(AHORA.getTime() + 3_600_000),
      },
    };
    return { actor, datos };
  }

  it('dos solicitudes de las mismas fechas a la vez: solo una se registra y la otra recibe CONFLICTO', async () => {
    const { actor, datos } = await datosDe('0900000011', '2028-03-06', '2028-03-08', 3);
    // Elisa ya tiene una solicitud de la prueba de cinco en paralelo: se parte de cero
    await limpiarSolicitudesDe(actor.id);
    await dejarSaldo(actor.id, 30);

    const resultados = await Promise.allSettled([
      repositorio.registrarSolicitud(1, datos),
      repositorio.registrarSolicitud(1, datos),
    ]);
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]?.reason).toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('dos solicitudes distintas que no caben en el saldo: solo una se registra y la otra recibe REGLA_DE_NEGOCIO', async () => {
    const primera = await datosDe('0900000012', '2028-03-06', '2028-03-08', 3);
    const segunda = await datosDe('0900000012', '2028-03-13', '2028-03-15', 3);
    // Manuel ya tiene un dia reservado de la prueba de cinco en paralelo: se parte de cero
    await limpiarSolicitudesDe(primera.actor.id);
    await dejarSaldo(primera.actor.id, 3);

    const resultados = await Promise.allSettled([
      repositorio.registrarSolicitud(1, primera.datos),
      repositorio.registrarSolicitud(1, segunda.datos),
    ]);
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]?.reason).toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });
});

describe('leer contra MySQL', () => {
  it('lista y filtra el historial de Luis', async () => {
    const luis = await actorDe('0900000007');
    const pagina = await servicio.listarPropias(luis, { pagina: 1, porPagina: 20 });
    expect(pagina.total).toBe(1);
    expect(pagina.solicitudes[0]).toMatchObject({ ordenTramite: 'VAC-2026-000001', diasSolicitados: 3, tipo: 'PROGRAMADA' });
    const autorizadas = await servicio.listarPropias(luis, { estado: 'AUTORIZADA', pagina: 1, porPagina: 20 });
    expect(autorizadas.total).toBe(0);
  });

  it('el hospital ajeno no ve la solicitud, y Talento Humano del mismo hospital si', async () => {
    const luis = await actorDe('0900000007');
    const { solicitudes } = await servicio.listarPropias(luis, { pagina: 1, porPagina: 20 });
    const id = solicitudes[0]?.id ?? 0;
    const tomas = await actorDe('0900000005');
    await expect(servicio.obtener(tomas, id)).resolves.toMatchObject({ id });
    const ana = await actorDe('0900000007', 2);
    await expect(servicio.obtener({ ...ana, rol: 'TALENTO_HUMANO' }, id)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});

// Va al final: aprobar cambia el estado de solicitudes que las pruebas de arriba todavia cuentan como pendientes
describe('decidir contra MySQL', () => {
  interface FilaSolicitudBd {
    estado: string;
    resueltoPorId: number | null;
    motivoResolucion: string | null;
    tomadosPrevios: string | number | null;
    disponiblesPrevios: string | number | null;
    vistoBuenoPorId: number | null;
  }

  async function idDeSolicitud(cedula: string, fechaInicio: string): Promise<number> {
    const actor = await actorDe(cedula);
    const { solicitudes } = await servicio.listarPropias(actor, { pagina: 1, porPagina: 100 });
    const encontrada = solicitudes.find((s) => s.fechaInicio === fechaInicio);
    if (!encontrada) throw new Error(`${cedula} no tiene una solicitud con inicio ${fechaInicio}`);
    return encontrada.id;
  }

  async function solicitudEnBd(id: number): Promise<FilaSolicitudBd> {
    const [fila] = await bd.consultar<FilaSolicitudBd>(
      `SELECT estado, resuelto_por_id AS resueltoPorId, motivo_resolucion AS motivoResolucion,
              dias_tomados_previos AS tomadosPrevios, dias_disponibles_previos AS disponiblesPrevios,
              visto_bueno_por_id AS vistoBuenoPorId
       FROM solicitudes_vacaciones WHERE empresa_id = 1 AND id = ?`,
      [id],
    );
    if (!fila) throw new Error(`No existe la solicitud ${String(id)}`);
    return fila;
  }

  // Dias usados de cada periodo de la persona, del mas antiguo al mas nuevo
  async function usadosPorPeriodo(usuarioId: number): Promise<number[]> {
    const filas = await bd.consultar<{ diasUsados: string | number }>(
      'SELECT dias_usados AS diasUsados FROM periodos_vacaciones WHERE empresa_id = 1 AND usuario_id = ? ORDER BY fecha_inicio',
      [usuarioId],
    );
    return filas.map((fila) => aNumero(fila.diasUsados));
  }

  // Dias que se descontaron de cada periodo para una solicitud, del periodo mas antiguo al mas nuevo
  async function descuentosDe(solicitudId: number): Promise<number[]> {
    const filas = await bd.consultar<{ dias: string | number }>(
      `SELECT d.dias AS dias FROM solicitud_descuentos d
       INNER JOIN periodos_vacaciones p ON p.id = d.periodo_id
       WHERE d.solicitud_id = ? ORDER BY p.fecha_inicio`,
      [solicitudId],
    );
    return filas.map((fila) => aNumero(fila.dias));
  }

  async function estadosDePasos(solicitudId: number): Promise<string[]> {
    const filas = await bd.consultar<{ estado: string }>(
      'SELECT estado FROM solicitud_aprobaciones WHERE empresa_id = 1 AND solicitud_id = ? ORDER BY orden, id',
      [solicitudId],
    );
    return filas.map((fila) => fila.estado);
  }

  async function notificacionesDe(usuarioId: number): Promise<{ tipo: string; mensaje: string; referenciaId: number }[]> {
    return bd.consultar<{ tipo: string; mensaje: string; referenciaId: number }>(
      `SELECT tipo, mensaje, referencia_id AS referenciaId FROM notificaciones
       WHERE empresa_id = 1 AND usuario_id = ? ORDER BY id`,
      [usuarioId],
    );
  }

  it('Laura aprueba la solicitud de Luis: queda AUTORIZADA y los dias salen del periodo que caduca antes', async () => {
    const luis = await actorDe('0900000007');
    const laura = await actorDe('0900000006');
    const id = await idDeSolicitud('0900000007', '2026-11-02');

    const solicitud = await servicio.aprobar(laura, id, {});

    expect(solicitud).toMatchObject({ estado: 'AUTORIZADA', fechaResolucion: AHORA });
    expect(solicitud.pasos[0]).toMatchObject({ estado: 'APROBADO', decididoAt: AHORA });
    expect(solicitud.pasos[0]?.decididoPor?.id).toBe(laura.id);

    // FIFO: el periodo de 2025 caduca antes que el de 2026
    expect(await usadosPorPeriodo(luis.id)).toEqual([3, 0]);
    expect(await descuentosDe(id)).toEqual([3]);

    const fila = await solicitudEnBd(id);
    expect(fila.resueltoPorId).toBe(laura.id);
    expect(aNumero(fila.tomadosPrevios)).toBe(0);
    expect(aNumero(fila.disponiblesPrevios)).toBe(60);

    expect(await notificacionesDe(luis.id)).toEqual([
      {
        tipo: 'SOLICITUD_APROBADA',
        mensaje: '¡Buenas noticias, Luis! Tu solicitud de Vacaciones fue aprobada por tu jefe.',
        referenciaId: id,
      },
    ]);
  });

  it('si al periodo mas antiguo le quedan pocos dias, el descuento sigue en el siguiente', async () => {
    const ernesto = await actorDe('0900000010');
    const nora = await actorDe('0900000009');
    const id = await idDeSolicitud('0900000010', '2026-11-02');
    await bd.ejecutar(
      "UPDATE periodos_vacaciones SET dias_usados = 28 WHERE empresa_id = 1 AND usuario_id = ? AND fecha_inicio = '2025-01-01'",
      [ernesto.id],
    );

    await servicio.aprobar(nora, id, {});

    expect(await usadosPorPeriodo(ernesto.id)).toEqual([30, 1]);
    expect(await descuentosDe(id)).toEqual([2, 1]);
    const fila = await solicitudEnBd(id);
    expect(aNumero(fila.tomadosPrevios)).toBe(28);
    expect(aNumero(fila.disponiblesPrevios)).toBe(32);
  });

  it('si el saldo ya no alcanza al autorizar, no cambia nada: la solicitud sigue pendiente', async () => {
    const lucia = await actorDe('0900000008');
    const laura = await actorDe('0900000006');
    const id = await idDeSolicitud('0900000008', '2026-10-19');
    await bd.ejecutar('UPDATE periodos_vacaciones SET dias_usados = dias_derecho WHERE empresa_id = 1 AND usuario_id = ?', [
      lucia.id,
    ]);

    await expect(servicio.aprobar(laura, id, {})).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });

    expect((await solicitudEnBd(id)).estado).toBe('PENDIENTE');
    expect(await estadosDePasos(id)).toEqual(['PENDIENTE']);
    expect(await descuentosDe(id)).toEqual([]);
    expect(await usadosPorPeriodo(lucia.id)).toEqual([30, 30]);
    expect(await notificacionesDe(lucia.id)).toEqual([]);
  });

  it('el Director niega la solicitud de Silvia: queda NEGADA, avisa con el motivo y libera los dias reservados', async () => {
    const silvia = await actorDe('0900000003');
    const diego = await actorDe('0900000002');
    const id = await idDeSolicitud('0900000003', '2026-11-02');
    expect(await repositorio.saldoDisponible(1, silvia.id, '2026-11-02')).toBe(57);

    const solicitud = await servicio.negar(diego, id, { motivo: 'Falta personal en el servicio' });

    expect(solicitud).toMatchObject({ estado: 'NEGADA', motivoResolucion: 'Falta personal en el servicio' });
    expect(solicitud.pasos[0]).toMatchObject({ estado: 'NEGADO' });
    expect(await repositorio.saldoDisponible(1, silvia.id, '2026-11-02')).toBe(60);
    expect(await usadosPorPeriodo(silvia.id)).toEqual([0, 0]);
    expect(await notificacionesDe(silvia.id)).toEqual([
      {
        tipo: 'SOLICITUD_NEGADA',
        mensaje: 'Tu solicitud de Vacaciones fue negada por el Rector. Motivo: Falta personal en el servicio',
        referenciaId: id,
      },
    ]);
  });

  it('Diego cancela su solicitud; la autorizada de Luis ya no se puede cancelar', async () => {
    const diego = await actorDe('0900000002');
    const luis = await actorDe('0900000007');
    const idDiego = await idDeSolicitud('0900000002', '2026-11-02');
    const idLuis = await idDeSolicitud('0900000007', '2026-11-02');

    const cancelada = await servicio.cancelar(diego, idDiego, { motivo: 'Cambio de fechas' });
    expect(cancelada).toMatchObject({ estado: 'CANCELADA', motivoResolucion: 'Cambio de fechas' });
    expect(await estadosDePasos(idDiego)).toEqual(['CANCELADO']);
    expect(await notificacionesDe(diego.id)).toEqual([]);

    await expect(servicio.cancelar(luis, idLuis, {})).rejects.toMatchObject({ codigo: 'CONFLICTO' });
    expect((await solicitudEnBd(idLuis)).estado).toBe('AUTORIZADA');
  });

  it('dos aprobaciones a la vez de la misma solicitud: solo una se aplica, sin descontar dos veces ni avisar dos veces', async () => {
    const teresa = await actorDe('0900000004');
    const silvia = await actorDe('0900000003');
    const id = await idDeSolicitud('0900000004', '2027-03-29');

    const resultados = await Promise.allSettled([servicio.aprobar(silvia, id, {}), servicio.aprobar(silvia, id, {})]);
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]?.reason).toMatchObject({ codigo: 'CONFLICTO' });

    // Solo vale el periodo de 2026: el de 2025 caduco el 1 de enero de 2027
    expect(await usadosPorPeriodo(teresa.id)).toEqual([0, 1]);
    expect(await descuentosDe(id)).toEqual([1]);
    expect(await notificacionesDe(teresa.id)).toHaveLength(1);
  });

  it('con una ruta de dos pasos: Teresa da el visto bueno, abre el paso del Director y su aprobacion autoriza', async () => {
    const tomas = await actorDe('0900000005');
    const teresa = await actorDe('0900000004');
    const diego = await actorDe('0900000002');
    const id = await idDeSolicitud('0900000005', '2027-03-22');
    // Tomas es de nivel 4: se le agrega un segundo paso a la ruta de ese nivel solo durante esta prueba
    await bd.ejecutar(
      "INSERT INTO rutas_aprobacion (empresa_id, nivel_solicitante, orden, tipo_aprobador) VALUES (1, 4, 2, 'AUTORIDAD_MAXIMA')",
    );
    try {
      const intermedia = await servicio.aprobar(teresa, id, {});
      expect(intermedia.estado).toBe('VISTO_BUENO');
      expect(intermedia.pasos).toHaveLength(2);
      expect(intermedia.pasos[1]).toMatchObject({
        orden: 2,
        tipoAprobador: 'AUTORIDAD_MAXIMA',
        estado: 'PENDIENTE',
        venceAt: new Date('2026-10-15T16:00:00Z'),
      });
      expect(intermedia.pasos[1]?.aprobador.id).toBe(diego.id);
      expect((await solicitudEnBd(id)).vistoBuenoPorId).toBe(teresa.id);
      // Todavia no se descuenta ni se avisa
      expect(await usadosPorPeriodo(tomas.id)).toEqual([0, 0]);
      expect(await notificacionesDe(tomas.id)).toEqual([]);

      const final = await servicio.aprobar(diego, id, {});
      expect(final.estado).toBe('AUTORIZADA');
      expect(await estadosDePasos(id)).toEqual(['APROBADO', 'APROBADO']);
      expect(await usadosPorPeriodo(tomas.id)).toEqual([0, 1]);
      const avisos = await notificacionesDe(tomas.id);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]?.mensaje).toBe('¡Buenas noticias, Tomás! Tu solicitud de Vacaciones fue aprobada por el Rector.');
    } finally {
      await bd.ejecutar('DELETE FROM rutas_aprobacion WHERE empresa_id = 1 AND nivel_solicitante = 4 AND orden = 2');
    }
  });
});