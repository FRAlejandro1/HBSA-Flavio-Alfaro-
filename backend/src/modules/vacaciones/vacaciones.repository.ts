
 // Acceso a datos de vacaciones. Solo SQL parametrizado y siempre filtrado por empresa_id.
// El service depende de IVacacionesRepository, no de esta clase.
import type { IBaseDatos, IConexionBD, ValorSql } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import {
  ESTADOS_EN_TRAMITE,
  MENSAJE_PASO_RESUELTO,
  MENSAJE_SOLAPAMIENTO,
  mensajeSaldoInsuficiente,
} from './vacaciones.dominio';
import type {
  DatosAprobacionIntermedia,
  DatosCancelacion,
  DatosDecision,
  DatosEscalamientoPlazo,
  DatosNuevaSolicitud,
  DatosResolucionFinal,
  EstadoPaso,
  EstadoSolicitud,
  FiltrosSolicitudes,
  NotificacionNueva,
  OrigenPaso,
  PasoAprobacion,
  PasoVencido,
  Solicitante,
  SolicitudDetalle,
  SolicitudResumen,
  TipoAprobador,
  TipoSolicitud,
} from './vacaciones.dominio';

export interface IVacacionesRepository {
  // null si la persona no existe en ese hospital
  buscarSolicitante: (empresaId: number, usuarioId: number) => Promise<Solicitante | null>;
  // Tipos de aprobador de la ruta para un nivel jerarquico, en orden de paso
  listarRuta: (empresaId: number, nivelJerarquico: number) => Promise<TipoAprobador[]>;
  // Persona activa que debe aprobar segun el tipo; null si no hay ninguna
  resolverAprobador: (
    empresaId: number,
    tipo: TipoAprobador,
    solicitante: Solicitante,
  ) => Promise<number | null>;
  // Busca los pasos pendientes cuyo plazo de aprobacion ya vencio
  listarPasosVencidos: (ahora: Date, limite: number) => Promise<PasoVencido[]>;
  // Escala un paso vencido en una transaccion; false si ya fue resuelto o escalado
  escalarPasoVencido: (
    empresaId: number,
    datos: DatosEscalamientoPlazo,
    ahora: Date,
  ) => Promise<boolean>;
  // Feriados (AAAA-MM-DD) dentro del rango, ambos extremos incluidos
  feriadosEntre: (inicio: string, fin: string) => Promise<string[]>;
  // true si la persona ya tiene una solicitud en tramite o autorizada que se cruza con el rango
  existeSolapamiento: (
    empresaId: number,
    usuarioId: number,
    inicio: string,
    fin: string,
  ) => Promise<boolean>;
  // Dias que la persona puede pedir: los de sus periodos vigentes en la fecha que aun no se han usado,
  // menos los que ya tiene reservados en solicitudes en tramite (el descuento real es al autorizar)
  saldoDisponible: (empresaId: number, usuarioId: number, fecha: string) => Promise<number>;
  // Guarda la solicitud, su numero de tramite y su primer paso en una sola transaccion; devuelve el id.
  // Dentro de la transaccion repite el solapamiento y el saldo con la persona bloqueada, y lanza
  // CONFLICTO o REGLA_DE_NEGOCIO si dos solicitudes simultaneas se cuelan por las comprobaciones previas.
  registrarSolicitud: (empresaId: number, datos: DatosNuevaSolicitud) => Promise<number>;
  // Aprueba un paso que no es el ultimo: la solicitud queda en VISTO_BUENO y se abre el paso siguiente
  aprobarPasoIntermedio: (empresaId: number, datos: DatosAprobacionIntermedia) => Promise<void>;
  // Aprueba el ultimo paso: autoriza la solicitud, descuenta los dias de los periodos (FIFO) y avisa a la persona
  autorizarSolicitud: (empresaId: number, datos: DatosResolucionFinal) => Promise<void>;
  // Niega la solicitud (los dias reservados se liberan solos) y avisa a la persona
  negarSolicitud: (empresaId: number, datos: DatosResolucionFinal) => Promise<void>;
  // La persona cancela su solicitud mientras sigue en tramite
  cancelarSolicitud: (empresaId: number, datos: DatosCancelacion) => Promise<void>;
  // hoy (AAAA-MM-DD en la zona del hospital) sirve para marcar si cada aprobador esta disponible
  obtenerSolicitud: (empresaId: number, id: number, hoy: string) => Promise<SolicitudDetalle | null>;
  listarSolicitudesDe: (
    empresaId: number,
    usuarioId: number,
    filtros: FiltrosSolicitudes,
  ) => Promise<{ solicitudes: SolicitudResumen[]; total: number }>;
}

interface FilaSolicitante {
  id: number;
  areaId: number;
  cargoId: number;
  nivelJerarquico: number;
  telefono: string | null;
  jefeInmediatoId: number | null;
  estado: 'ACTIVO' | 'INACTIVO';
  lugar: string;
}

interface FilaSolicitud {
  id: number;
  ordenTramite: string;
  usuarioId: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  areaId: number;
  areaDetalle: string;
  cargoId: number;
  cargoDetalle: string;
  lugar: string;
  telefonoLocalizacion: string | null;
  solicitadoAt: Date;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: string | number;
  justificacion: string | null;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  motivoResolucion: string | null;
  fechaResolucion: Date | null;
}

interface FilaPaso {
  id: number;
  orden: number;
  tipoAprobador: TipoAprobador;
  origen: OrigenPaso;
  estado: EstadoPaso;
  motivo: string | null;
  asignadoAt: Date;
  venceAt: Date | null;
  decididoAt: Date | null;
  aprobadorId: number;
  aprobadorNombres: string;
  aprobadorApellidos: string;
  aprobadorDisponible: number;
  decididoPorId: number | null;
  decididoPorNombres: string | null;
  decididoPorApellidos: string | null;
}

interface FilaPasoVencidoBloqueado {
  estado: EstadoPaso;
  tipoAprobador: TipoAprobador;
  venceAt: Date | null;
}

interface FilaPasoBloqueado {
  estado: EstadoPaso;
  aprobadorId: number;
}

interface FilaPeriodo {
  id: number;
  diasDerecho: string | number;
  diasUsados: string | number;
}

interface FilaResumen {
  id: number;
  ordenTramite: string;
  fechaInicio: string;
  fechaFin: string;
  diasSolicitados: string | number;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  solicitadoAt: Date;
}

// Solicitud bloqueada para decidirla: lo que hace falta para descontar sus dias
interface FilaSolicitudBloqueada {
  estado: EstadoSolicitud;
  usuarioId: number;
  fechaInicio: string;
  diasSolicitados: string | number;
}

// Estado de los periodos de la persona justo antes de descontar una solicitud (va al PDF de Talento Humano)
interface InstantaneaSaldo {
  tomadosPrevios: number;
  disponiblesPrevios: number;
}

const MENSAJES: MensajesErrorBD = {
  duplicado: 'Ya existe una solicitud con ese numero de tramite',
  enUso: 'La solicitud tiene registros asociados y no se puede eliminar',
  referenciaInvalida: 'La persona, el area, el cargo o el aprobador indicado no existe en este hospital',
};

// Estados en los que una solicitud todavia ocupa sus fechas
const ESTADOS_QUE_OCUPAN = "('PENDIENTE', 'VISTO_BUENO', 'AUTORIZADA')";

// Estados en los que una solicitud tiene dias reservados: aun no se descontaron de ningun periodo
const ESTADOS_QUE_RESERVAN = "('PENDIENTE', 'VISTO_BUENO')";

// Los DECIMAL llegan como texto desde mysql2
function aNumero(valor: string | number): number {
  return Number.parseFloat(String(valor));
}

// Los dias se manejan con dos decimales (medio dia): se redondea para no arrastrar errores de coma flotante
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// Las dos comprobaciones sirven fuera de una transaccion (aviso rapido del service)
// y dentro de ella (la definitiva, con la persona bloqueada)
async function haySolapamiento(
  conexion: IConexionBD,
  empresaId: number,
  usuarioId: number,
  inicio: string,
  fin: string,
): Promise<boolean> {
  const filas = await conexion.consultar<{ uno: number }>(
    `SELECT 1 AS uno FROM solicitudes_vacaciones
     WHERE empresa_id = ? AND usuario_id = ? AND estado IN ${ESTADOS_QUE_OCUPAN}
       AND fecha_inicio <= ? AND fecha_fin >= ?
     LIMIT 1`,
    [empresaId, usuarioId, fin, inicio],
  );
  return filas.length > 0;
}

// Saldo para pedir: lo que queda en los periodos vigentes menos lo reservado por solicitudes en tramite
async function leerSaldo(
  conexion: IConexionBD,
  empresaId: number,
  usuarioId: number,
  fecha: string,
): Promise<number> {
  const [fila] = await conexion.consultar<{ saldo: string | number | null }>(
    `SELECT
       COALESCE((SELECT SUM(p.dias_derecho - p.dias_usados) FROM periodos_vacaciones p
                 WHERE p.empresa_id = ? AND p.usuario_id = ?
                   AND p.fecha_inicio <= ? AND p.fecha_caducidad >= ?), 0)
       - COALESCE((SELECT SUM(s.dias_solicitados) FROM solicitudes_vacaciones s
                   WHERE s.empresa_id = ? AND s.usuario_id = ?
                     AND s.estado IN ${ESTADOS_QUE_RESERVAN}), 0) AS saldo`,
    [empresaId, usuarioId, fecha, fecha, empresaId, usuarioId],
  );
  // Nunca se muestra un saldo negativo
  return Math.max(0, aNumero(fila?.saldo ?? 0));
}

// Bloquea la solicitud y comprueba que sigue en tramite: dos decisiones sobre la misma solicitud se hacen una tras otra
async function bloquearSolicitudEnTramite(
  conexion: IConexionBD,
  empresaId: number,
  solicitudId: number,
): Promise<FilaSolicitudBloqueada> {
  const [solicitud] = await conexion.consultar<FilaSolicitudBloqueada>(
    `SELECT estado, usuario_id AS usuarioId, fecha_inicio AS fechaInicio, dias_solicitados AS diasSolicitados
     FROM solicitudes_vacaciones WHERE empresa_id = ? AND id = ? FOR UPDATE`,
    [empresaId, solicitudId],
  );
  if (!solicitud) {
    throw AppError.noEncontrado('La solicitud no existe');
  }
  if (!ESTADOS_EN_TRAMITE.includes(solicitud.estado)) {
    throw AppError.conflicto(MENSAJE_PASO_RESUELTO);
  }
  return solicitud;
}

// Bloquea la solicitud y su paso, y comprueba que el paso sigue pendiente y es de quien decide
async function bloquearDecision(
  conexion: IConexionBD,
  empresaId: number,
  datos: DatosDecision,
): Promise<FilaSolicitudBloqueada> {
  const solicitud = await bloquearSolicitudEnTramite(conexion, empresaId, datos.solicitudId);
  const [paso] = await conexion.consultar<FilaPasoBloqueado>(
    `SELECT estado, aprobador_id AS aprobadorId FROM solicitud_aprobaciones
     WHERE empresa_id = ? AND id = ? AND solicitud_id = ? FOR UPDATE`,
    [empresaId, datos.pasoId, datos.solicitudId],
  );
  if (!paso || paso.estado !== 'PENDIENTE' || Number(paso.aprobadorId) !== datos.aprobadorId) {
    throw AppError.conflicto(MENSAJE_PASO_RESUELTO);
  }
  return solicitud;
}

// Cierra un paso con su decision; el CHECK de la base exige decidido_at en todo paso que no este pendiente
async function marcarPaso(
  conexion: IConexionBD,
  empresaId: number,
  datos: DatosDecision,
  estado: 'APROBADO' | 'NEGADO',
): Promise<void> {
  await conexion.ejecutar(
    `UPDATE solicitud_aprobaciones
     SET estado = ?, decidido_por_id = ?, decidido_at = ?, motivo = ?
     WHERE empresa_id = ? AND id = ?`,
    [estado, datos.aprobadorId, datos.decididoAt, datos.motivo, empresaId, datos.pasoId],
  );
}

async function crearNotificacion(
  conexion: IConexionBD,
  empresaId: number,
  solicitudId: number,
  notificacion: NotificacionNueva,
): Promise<void> {
  await conexion.ejecutar(
    `INSERT INTO notificaciones (empresa_id, usuario_id, tipo, referencia_id, mensaje)
     VALUES (?, ?, ?, ?, ?)`,
    [empresaId, notificacion.usuarioId, notificacion.tipo, solicitudId, notificacion.mensaje],
  );
}

// Descuento FIFO: consume primero el periodo que caduca antes, entre los vigentes a la fecha de inicio,
// y deja en solicitud_descuentos de cual salio cada dia (con eso se podra revertir)
async function descontarDePeriodos(
  conexion: IConexionBD,
  empresaId: number,
  usuarioId: number,
  solicitudId: number,
  fechaInicio: string,
  dias: number,
): Promise<InstantaneaSaldo> {
  const periodos = await conexion.consultar<FilaPeriodo>(
    `SELECT id, dias_derecho AS diasDerecho, dias_usados AS diasUsados FROM periodos_vacaciones
     WHERE empresa_id = ? AND usuario_id = ? AND fecha_inicio <= ? AND fecha_caducidad >= ?
     ORDER BY fecha_caducidad, fecha_inicio, id
     FOR UPDATE`,
    [empresaId, usuarioId, fechaInicio, fechaInicio],
  );

  let tomadosPrevios = 0;
  let disponiblesPrevios = 0;
  for (const periodo of periodos) {
    tomadosPrevios += aNumero(periodo.diasUsados);
    disponiblesPrevios += aNumero(periodo.diasDerecho) - aNumero(periodo.diasUsados);
  }
  tomadosPrevios = redondear(tomadosPrevios);
  disponiblesPrevios = redondear(disponiblesPrevios);

  // Recomprobacion con los periodos bloqueados: si ya no alcanza, no se autoriza
  if (disponiblesPrevios < dias) {
    throw AppError.reglaDeNegocio(
      `El saldo de la persona ya no alcanza: tiene ${String(disponiblesPrevios)} dias disponibles y la solicitud pide ${String(dias)}`,
    );
  }

  let porDescontar = dias;
  for (const periodo of periodos) {
    if (porDescontar <= 0) {
      break;
    }
    const libre = redondear(aNumero(periodo.diasDerecho) - aNumero(periodo.diasUsados));
    if (libre <= 0) {
      continue;
    }
    const toma = Math.min(libre, porDescontar);
    await conexion.ejecutar(
      'UPDATE periodos_vacaciones SET dias_usados = dias_usados + ? WHERE empresa_id = ? AND id = ?',
      [toma, empresaId, periodo.id],
    );
    await conexion.ejecutar(
      'INSERT INTO solicitud_descuentos (solicitud_id, periodo_id, dias) VALUES (?, ?, ?)',
      [solicitudId, periodo.id, toma],
    );
    porDescontar = redondear(porDescontar - toma);
  }
  return { tomadosPrevios, disponiblesPrevios };
}

function aPersona(
  id: number | null,
  nombres: string | null,
  apellidos: string | null,
): { id: number; nombres: string; apellidos: string } | null {
  return id !== null && nombres !== null && apellidos !== null ? { id, nombres, apellidos } : null;
}

function aPaso(fila: FilaPaso): PasoAprobacion {
  return {
    id: fila.id,
    orden: fila.orden,
    tipoAprobador: fila.tipoAprobador,
    origen: fila.origen,
    estado: fila.estado,
    aprobador: { id: fila.aprobadorId, nombres: fila.aprobadorNombres, apellidos: fila.aprobadorApellidos },
    aprobadorDisponible: Number(fila.aprobadorDisponible) === 1,
    decididoPor: aPersona(fila.decididoPorId, fila.decididoPorNombres, fila.decididoPorApellidos),
    motivo: fila.motivo,
    asignadoAt: fila.asignadoAt,
    venceAt: fila.venceAt,
    decididoAt: fila.decididoAt,
  };
}

export class VacacionesRepository implements IVacacionesRepository {
  constructor(private readonly bd: IBaseDatos) {}

  async buscarSolicitante(empresaId: number, usuarioId: number): Promise<Solicitante | null> {
    const [fila] = await this.bd.consultar<FilaSolicitante>(
      `SELECT u.id AS id, u.area_id AS areaId, u.cargo_id AS cargoId,
              c.nivel_jerarquico AS nivelJerarquico, u.telefono AS telefono,
              u.jefe_inmediato_id AS jefeInmediatoId, u.estado AS estado, e.lugar AS lugar
       FROM usuarios u
       INNER JOIN cargos c ON c.empresa_id = u.empresa_id AND c.id = u.cargo_id
       INNER JOIN empresas e ON e.id = u.empresa_id
       WHERE u.empresa_id = ? AND u.id = ? LIMIT 1`,
      [empresaId, usuarioId],
    );
    return fila ?? null;
  }

  async listarRuta(empresaId: number, nivelJerarquico: number): Promise<TipoAprobador[]> {
    const filas = await this.bd.consultar<{ tipoAprobador: TipoAprobador }>(
      `SELECT tipo_aprobador AS tipoAprobador FROM rutas_aprobacion
       WHERE empresa_id = ? AND nivel_solicitante = ? ORDER BY orden`,
      [empresaId, nivelJerarquico],
    );
    return filas.map((fila) => fila.tipoAprobador);
  }

  async resolverAprobador(
    empresaId: number,
    tipo: TipoAprobador,
    solicitante: Solicitante,
  ): Promise<number | null> {
    // Cada tipo se resuelve con su consulta fija; siempre se exige que la persona este activa
    let filas: { id: number }[];
    switch (tipo) {
      case 'JEFE_INMEDIATO':
        if (solicitante.jefeInmediatoId === null) {
          return null;
        }
        filas = await this.bd.consultar<{ id: number }>(
          "SELECT id FROM usuarios WHERE empresa_id = ? AND id = ? AND estado = 'ACTIVO' LIMIT 1",
          [empresaId, solicitante.jefeInmediatoId],
        );
        break;
      case 'JEFE_AREA':
        filas = await this.bd.consultar<{ id: number }>(
          `SELECT u.id AS id FROM areas a
           INNER JOIN usuarios u ON u.empresa_id = a.empresa_id AND u.id = a.jefe_id AND u.estado = 'ACTIVO'
           WHERE a.empresa_id = ? AND a.id = ? LIMIT 1`,
          [empresaId, solicitante.areaId],
        );
        break;
      case 'AUTORIDAD_MAXIMA':
        filas = await this.bd.consultar<{ id: number }>(
          `SELECT u.id AS id FROM usuarios u
           INNER JOIN cargos c ON c.empresa_id = u.empresa_id AND c.id = u.cargo_id
           WHERE u.empresa_id = ? AND c.nivel_jerarquico = 1 AND u.estado = 'ACTIVO'
           ORDER BY u.id LIMIT 1`,
          [empresaId],
        );
        break;
      case 'SUPERADMIN':
        filas = await this.bd.consultar<{ id: number }>(
          `SELECT u.id AS id FROM usuarios u
           INNER JOIN roles r ON r.id = u.rol_id
           WHERE u.empresa_id = ? AND r.codigo = 'SUPERADMIN' AND u.estado = 'ACTIVO'
           ORDER BY u.id LIMIT 1`,
          [empresaId],
        );
        break;
    }
    return filas[0]?.id ?? null;
  }

  async listarPasosVencidos(ahora: Date, limite: number): Promise<PasoVencido[]> {
    const limiteEntero = Number.isFinite(limite) ? Math.trunc(limite) : 100;
    const limiteSeguro = Math.min(500, Math.max(1, limiteEntero));

    return this.bd.consultar<PasoVencido>(
      `SELECT p.empresa_id AS empresaId,
              p.solicitud_id AS solicitudId,
              p.id AS pasoId,
              p.orden AS orden,
              p.tipo_aprobador AS tipoAprobador,
              s.usuario_id AS solicitanteId
       FROM solicitud_aprobaciones p
       INNER JOIN solicitudes_vacaciones s
         ON s.empresa_id = p.empresa_id AND s.id = p.solicitud_id
       WHERE p.estado = 'PENDIENTE'
         AND p.vence_at IS NOT NULL
         AND p.vence_at <= ?
         AND p.tipo_aprobador <> 'SUPERADMIN'
         AND s.estado IN ('PENDIENTE', 'VISTO_BUENO')
       ORDER BY p.vence_at, p.id
       LIMIT ${limiteSeguro}`,
      [ahora],
    );
  }

  async escalarPasoVencido(
    empresaId: number,
    datos: DatosEscalamientoPlazo,
    ahora: Date,
  ): Promise<boolean> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        // Bloquea primero la solicitud para serializar las decisiones y los escalamientos
        const [solicitud] = await conexion.consultar<{ estado: EstadoSolicitud }>(
          `SELECT estado FROM solicitudes_vacaciones
           WHERE empresa_id = ? AND id = ? FOR UPDATE`,
          [empresaId, datos.solicitudId],
        );

        if (!solicitud || !ESTADOS_EN_TRAMITE.includes(solicitud.estado)) {
          return false;
        }

        // Revalida el vencimiento y el estado despues de obtener el bloqueo
        const [paso] = await conexion.consultar<FilaPasoVencidoBloqueado>(
          `SELECT estado, tipo_aprobador AS tipoAprobador, vence_at AS venceAt
           FROM solicitud_aprobaciones
           WHERE empresa_id = ? AND solicitud_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, datos.solicitudId, datos.pasoId],
        );

        if (
          !paso
          || paso.estado !== 'PENDIENTE'
          || paso.tipoAprobador === 'SUPERADMIN'
          || paso.venceAt === null
          || new Date(paso.venceAt).getTime() > ahora.getTime()
        ) {
          return false;
        }

        // El paso vencido queda cerrado antes de insertar el nuevo paso pendiente
        await conexion.ejecutar(
          `UPDATE solicitud_aprobaciones
           SET estado = 'ESCALADO', decidido_por_id = NULL, decidido_at = ?, motivo = ?
           WHERE empresa_id = ? AND solicitud_id = ? AND id = ? AND estado = 'PENDIENTE'`,
          [datos.escaladoAt, datos.motivo, empresaId, datos.solicitudId, datos.pasoId],
        );

        await conexion.ejecutar(
          `INSERT INTO solicitud_aprobaciones
             (empresa_id, solicitud_id, orden, tipo_aprobador, origen, aprobador_id, estado,
              decidido_por_id, decidido_at, escalada_desde_id, motivo, asignado_at, vence_at)
           VALUES (?, ?, ?, ?, 'ESCALAMIENTO_PLAZO', ?, 'PENDIENTE',
                   NULL, NULL, ?, ?, ?, ?)`,
          [
            empresaId,
            datos.solicitudId,
            datos.nuevaOrden,
            datos.nuevoTipoAprobador,
            datos.nuevoAprobadorId,
            datos.pasoId,
            datos.motivo,
            datos.escaladoAt,
            datos.nuevaVenceAt,
          ],
        );

        return true;
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async feriadosEntre(inicio: string, fin: string): Promise<string[]> {
    const filas = await this.bd.consultar<{ fecha: string }>(
      'SELECT fecha FROM feriados WHERE fecha BETWEEN ? AND ? ORDER BY fecha',
      [inicio, fin],
    );
    return filas.map((fila) => fila.fecha);
  }

  existeSolapamiento(
    empresaId: number,
    usuarioId: number,
    inicio: string,
    fin: string,
  ): Promise<boolean> {
    return haySolapamiento(this.bd, empresaId, usuarioId, inicio, fin);
  }

  saldoDisponible(empresaId: number, usuarioId: number, fecha: string): Promise<number> {
    return leerSaldo(this.bd, empresaId, usuarioId, fecha);
  }

  async registrarSolicitud(empresaId: number, datos: DatosNuevaSolicitud): Promise<number> {
    const anio = Number.parseFloat(datos.fechaSolicitud.slice(0, 4));
    try {
      return await this.bd.transaccion(async (conexion) => {
        // Bloquea la fila de la persona: dos solicitudes suyas a la vez se registran una tras otra y la segunda
        // ve lo que dejo la primera. Va antes de cualquier lectura sin bloqueo, porque InnoDB toma su instantanea
        // en la primera de ellas.
        await conexion.consultar('SELECT id FROM usuarios WHERE empresa_id = ? AND id = ? FOR UPDATE', [
          empresaId,
          datos.usuarioId,
        ]);

        // Comprobacion definitiva: el service ya avisa antes, pero solo aqui el resultado no puede cambiar
        if (await haySolapamiento(conexion, empresaId, datos.usuarioId, datos.fechaInicio, datos.fechaFin)) {
          throw AppError.conflicto(MENSAJE_SOLAPAMIENTO);
        }
        const saldo = await leerSaldo(conexion, empresaId, datos.usuarioId, datos.fechaInicio);
        if (saldo < datos.diasSolicitados) {
          throw AppError.reglaDeNegocio(mensajeSaldoInsuficiente(saldo, datos.diasSolicitados));
        }

        // Contador atomico por hospital y anio: LAST_INSERT_ID(expr) devuelve el numero asignado
        const secuencia = await conexion.ejecutar(
          `INSERT INTO secuencias_tramite (empresa_id, anio, ultimo) VALUES (?, ?, LAST_INSERT_ID(1))
           ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
          [empresaId, anio],
        );
        const ordenTramite = `VAC-${anio}-${String(secuencia.idInsertado).padStart(6, '0')}`;

        // El tipo (programada o no) lo deriva la base de fecha_solicitud y fecha_inicio
        const solicitud = await conexion.ejecutar(
          `INSERT INTO solicitudes_vacaciones
             (empresa_id, orden_tramite, usuario_id, area_id, cargo_id, lugar, telefono_localizacion,
              solicitado_at, fecha_solicitud, fecha_inicio, fecha_fin, justificacion, dias_solicitados)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            empresaId,
            ordenTramite,
            datos.usuarioId,
            datos.areaId,
            datos.cargoId,
            datos.lugar,
            datos.telefonoLocalizacion,
            datos.solicitadoAt,
            datos.fechaSolicitud,
            datos.fechaInicio,
            datos.fechaFin,
            datos.justificacion,
            datos.diasSolicitados,
          ],
        );

        const paso = datos.primerPaso;
        await conexion.ejecutar(
          `INSERT INTO solicitud_aprobaciones
             (empresa_id, solicitud_id, orden, tipo_aprobador, origen, aprobador_id, estado, asignado_at, vence_at)
           VALUES (?, ?, 1, ?, 'RUTA', ?, 'PENDIENTE', ?, ?)`,
          [empresaId, solicitud.idInsertado, paso.tipoAprobador, paso.aprobadorId, paso.asignadoAt, paso.venceAt],
        );
        return solicitud.idInsertado;
      });
    } catch (error) {
      // Un AppError (conflicto o regla de negocio) pasa tal cual; los errores de MySQL se traducen
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async aprobarPasoIntermedio(empresaId: number, datos: DatosAprobacionIntermedia): Promise<void> {
    try {
      await this.bd.transaccion(async (conexion) => {
        await bloquearDecision(conexion, empresaId, datos);
        await marcarPaso(conexion, empresaId, datos, 'APROBADO');
        await conexion.ejecutar(
          `UPDATE solicitudes_vacaciones
           SET estado = 'VISTO_BUENO', visto_bueno_por_id = ?, visto_bueno_at = ?
           WHERE empresa_id = ? AND id = ?`,
          [datos.aprobadorId, datos.decididoAt, empresaId, datos.solicitudId],
        );

        // El paso anterior ya no esta pendiente: recien ahora el indice unico deja abrir el siguiente
        const siguiente = datos.siguiente;
        await conexion.ejecutar(
          `INSERT INTO solicitud_aprobaciones
             (empresa_id, solicitud_id, orden, tipo_aprobador, origen, aprobador_id, estado, asignado_at, vence_at)
           VALUES (?, ?, ?, ?, 'RUTA', ?, 'PENDIENTE', ?, ?)`,
          [
            empresaId,
            datos.solicitudId,
            siguiente.orden,
            siguiente.tipoAprobador,
            siguiente.aprobadorId,
            siguiente.asignadoAt,
            siguiente.venceAt,
          ],
        );
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async autorizarSolicitud(empresaId: number, datos: DatosResolucionFinal): Promise<void> {
    try {
      await this.bd.transaccion(async (conexion) => {
        const solicitud = await bloquearDecision(conexion, empresaId, datos);
        await marcarPaso(conexion, empresaId, datos, 'APROBADO');

        // Los dias reservados pasan a descontarse de los periodos
        const saldo = await descontarDePeriodos(
          conexion,
          empresaId,
          solicitud.usuarioId,
          datos.solicitudId,
          solicitud.fechaInicio,
          aNumero(solicitud.diasSolicitados),
        );
        await conexion.ejecutar(
          `UPDATE solicitudes_vacaciones
           SET estado = 'AUTORIZADA', resuelto_por_id = ?, fecha_resolucion = ?,
               dias_tomados_previos = ?, dias_disponibles_previos = ?
           WHERE empresa_id = ? AND id = ?`,
          [
            datos.aprobadorId,
            datos.decididoAt,
            saldo.tomadosPrevios,
            saldo.disponiblesPrevios,
            empresaId,
            datos.solicitudId,
          ],
        );
        await crearNotificacion(conexion, empresaId, datos.solicitudId, datos.notificacion);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async negarSolicitud(empresaId: number, datos: DatosResolucionFinal): Promise<void> {
    try {
      await this.bd.transaccion(async (conexion) => {
        await bloquearDecision(conexion, empresaId, datos);
        await marcarPaso(conexion, empresaId, datos, 'NEGADO');
        await conexion.ejecutar(
          `UPDATE solicitudes_vacaciones
           SET estado = 'NEGADA', resuelto_por_id = ?, fecha_resolucion = ?, motivo_resolucion = ?
           WHERE empresa_id = ? AND id = ?`,
          [datos.aprobadorId, datos.decididoAt, datos.motivo, empresaId, datos.solicitudId],
        );
        await crearNotificacion(conexion, empresaId, datos.solicitudId, datos.notificacion);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async cancelarSolicitud(empresaId: number, datos: DatosCancelacion): Promise<void> {
    try {
      await this.bd.transaccion(async (conexion) => {
        const solicitud = await bloquearSolicitudEnTramite(conexion, empresaId, datos.solicitudId);
        if (Number(solicitud.usuarioId) !== datos.usuarioId) {
          throw AppError.prohibido('Solo quien la solicito puede cancelarla');
        }

        // El paso pendiente se cierra como CANCELADO; la reserva de dias se libera sola al cambiar el estado
        await conexion.ejecutar(
          `UPDATE solicitud_aprobaciones
           SET estado = 'CANCELADO', decidido_por_id = ?, decidido_at = ?
           WHERE empresa_id = ? AND solicitud_id = ? AND estado = 'PENDIENTE'`,
          [datos.usuarioId, datos.canceladaAt, empresaId, datos.solicitudId],
        );
        await conexion.ejecutar(
          `UPDATE solicitudes_vacaciones
           SET estado = 'CANCELADA', resuelto_por_id = ?, fecha_resolucion = ?, motivo_resolucion = ?
           WHERE empresa_id = ? AND id = ?`,
          [datos.usuarioId, datos.canceladaAt, datos.motivo, empresaId, datos.solicitudId],
        );
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async obtenerSolicitud(empresaId: number, id: number, hoy: string): Promise<SolicitudDetalle | null> {
    const [fila] = await this.bd.consultar<FilaSolicitud>(
      `SELECT s.id AS id, s.orden_tramite AS ordenTramite, s.usuario_id AS usuarioId,
              u.cedula AS cedula, u.nombres AS nombres, u.apellidos AS apellidos,
              a.id AS areaId, a.detalle AS areaDetalle, c.id AS cargoId, c.detalle AS cargoDetalle,
              s.lugar AS lugar, s.telefono_localizacion AS telefonoLocalizacion,
              s.solicitado_at AS solicitadoAt, s.fecha_solicitud AS fechaSolicitud,
              s.fecha_inicio AS fechaInicio, s.fecha_fin AS fechaFin,
              s.dias_solicitados AS diasSolicitados, s.justificacion AS justificacion,
              s.tipo AS tipo, s.estado AS estado, s.motivo_resolucion AS motivoResolucion,
              s.fecha_resolucion AS fechaResolucion
       FROM solicitudes_vacaciones s
       INNER JOIN usuarios u ON u.empresa_id = s.empresa_id AND u.id = s.usuario_id
       INNER JOIN areas a ON a.empresa_id = s.empresa_id AND a.id = s.area_id
       INNER JOIN cargos c ON c.empresa_id = s.empresa_id AND c.id = s.cargo_id
       WHERE s.empresa_id = ? AND s.id = ? LIMIT 1`,
      [empresaId, id],
    );
    if (!fila) {
      return null;
    }

    // Disponible: activo y sin vacaciones autorizadas que cubran el dia de hoy
    const pasos = await this.bd.consultar<FilaPaso>(
      `SELECT p.id AS id, p.orden AS orden, p.tipo_aprobador AS tipoAprobador, p.origen AS origen,
              p.estado AS estado, p.motivo AS motivo, p.asignado_at AS asignadoAt,
              p.vence_at AS venceAt, p.decidido_at AS decididoAt,
              ap.id AS aprobadorId, ap.nombres AS aprobadorNombres, ap.apellidos AS aprobadorApellidos,
              (ap.estado = 'ACTIVO' AND NOT EXISTS (
                 SELECT 1 FROM solicitudes_vacaciones v
                 WHERE v.empresa_id = p.empresa_id AND v.usuario_id = p.aprobador_id
                   AND v.estado = 'AUTORIZADA' AND ? BETWEEN v.fecha_inicio AND v.fecha_fin
              )) AS aprobadorDisponible,
              d.id AS decididoPorId, d.nombres AS decididoPorNombres, d.apellidos AS decididoPorApellidos
       FROM solicitud_aprobaciones p
       INNER JOIN usuarios ap ON ap.empresa_id = p.empresa_id AND ap.id = p.aprobador_id
       LEFT JOIN usuarios d ON d.empresa_id = p.empresa_id AND d.id = p.decidido_por_id
       WHERE p.empresa_id = ? AND p.solicitud_id = ?
       ORDER BY p.orden, p.id`,
      [hoy, empresaId, id],
    );

    return {
      id: fila.id,
      ordenTramite: fila.ordenTramite,
      solicitante: {
        id: fila.usuarioId,
        cedula: fila.cedula,
        nombres: fila.nombres,
        apellidos: fila.apellidos,
      },
      area: { id: fila.areaId, detalle: fila.areaDetalle },
      cargo: { id: fila.cargoId, detalle: fila.cargoDetalle },
      lugar: fila.lugar,
      telefonoLocalizacion: fila.telefonoLocalizacion,
      solicitadoAt: fila.solicitadoAt,
      fechaSolicitud: fila.fechaSolicitud,
      fechaInicio: fila.fechaInicio,
      fechaFin: fila.fechaFin,
      diasSolicitados: aNumero(fila.diasSolicitados),
      justificacion: fila.justificacion,
      tipo: fila.tipo,
      estado: fila.estado,
      motivoResolucion: fila.motivoResolucion,
      fechaResolucion: fila.fechaResolucion,
      pasos: pasos.map(aPaso),
    };
  }

  async listarSolicitudesDe(
    empresaId: number,
    usuarioId: number,
    filtros: FiltrosSolicitudes,
  ): Promise<{ solicitudes: SolicitudResumen[]; total: number }> {
    const condiciones = 'WHERE s.empresa_id = ? AND s.usuario_id = ?';
    const valores: ValorSql[] = [empresaId, usuarioId];
    let filtroEstado = '';
    if (filtros.estado !== undefined) {
      filtroEstado = ' AND s.estado = ?';
      valores.push(filtros.estado);
    }
    // Enteros ya validados por Zod: se escriben en la consulta porque LIMIT no admite parametros de forma fiable
    const limite = Math.trunc(filtros.porPagina);
    const desplazamiento = (Math.trunc(filtros.pagina) - 1) * limite;

    const [filas, conteo] = await Promise.all([
      this.bd.consultar<FilaResumen>(
        `SELECT s.id AS id, s.orden_tramite AS ordenTramite, s.fecha_inicio AS fechaInicio,
                s.fecha_fin AS fechaFin, s.dias_solicitados AS diasSolicitados, s.tipo AS tipo,
                s.estado AS estado, s.solicitado_at AS solicitadoAt
         FROM solicitudes_vacaciones s ${condiciones}${filtroEstado}
         ORDER BY s.solicitado_at DESC, s.id DESC LIMIT ${limite} OFFSET ${desplazamiento}`,
        valores,
      ),
      this.bd.consultar<{ total: number }>(
        `SELECT COUNT(*) AS total FROM solicitudes_vacaciones s ${condiciones}${filtroEstado}`,
        valores,
      ),
    ]);

    return {
      solicitudes: filas.map((fila) => ({ ...fila, diasSolicitados: aNumero(fila.diasSolicitados) })),
      total: Number.parseFloat(String(conteo[0]?.total ?? 0)),
    };
  }
}
