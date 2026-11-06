// Repositorio de jornadas laborales.
// Centraliza la persistencia MySQL de turnos y patrones rotativos,
// garantiza el aislamiento por empresa y registra las operaciones en auditoría.

import type { IBaseDatos } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type {
  AsignacionJornada,
  DatosActualizarTurno,
  DatosCerrarAsignacion,
  DatosNuevaAsignacion,
  DatosNuevoPatron,
  DatosNuevoTurno,
  DiaPatronJornada,
  PatronJornada,
  TurnoJornada,
} from './jornadas.dominio';

export interface IJornadasRepository {
  obtenerTurno(empresaId: number, turnoId: number): Promise<TurnoJornada | null>;
  listarTurnos(empresaId: number, incluirInactivos?: boolean): Promise<TurnoJornada[]>;
  crearTurno(empresaId: number, usuarioId: number, datos: DatosNuevoTurno): Promise<TurnoJornada>;
  actualizarTurno(
    empresaId: number,
    usuarioId: number,
    turnoId: number,
    datos: DatosActualizarTurno,
  ): Promise<TurnoJornada>;
  obtenerPatron(empresaId: number, patronId: number): Promise<PatronJornada | null>;
  listarPatrones(empresaId: number, incluirInactivos?: boolean): Promise<PatronJornada[]>;
  crearPatron(empresaId: number, usuarioId: number, datos: DatosNuevoPatron): Promise<PatronJornada>;
  crearAsignacion(
    empresaId: number,
    usuarioId: number,
    datos: DatosNuevaAsignacion,
  ): Promise<AsignacionJornada>;
  cerrarAsignacion(
    empresaId: number,
    usuarioId: number,
    datos: DatosCerrarAsignacion,
  ): Promise<AsignacionJornada>;
  obtenerAsignacionParaFecha(
    empresaId: number,
    usuarioId: number,
    fecha: string,
  ): Promise<AsignacionJornada | null>;
}

interface FilaTurno {
  id: number;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  minutos_descanso: number | string;
  activo: number | boolean;
}

interface FilaPatron {
  id: number;
  nombre: string;
  descripcion: string | null;
  ciclo_dias: number | string;
  activo: number | boolean;
}

interface FilaAsignacion {
  id: number;
  usuario_id: number;
  patron_id: number;
  fecha_inicio: string | Date;
  fecha_fin: string | Date | null;
  fecha_referencia: string | Date;
  configurado_por_id: number;
}

interface FilaDiaPatron {
  id: number;
  dia_ciclo: number | string;
  tipo_dia: 'TURNO' | 'DESCANSO';
  turno_id: number | null;
}

const MENSAJES_ERROR_ASIGNACION = {
  duplicado: 'Ya existe una asignación de jornada para ese período',
  enUso: 'La asignación está asociada a otros registros',
  referenciaInvalida: 'El empleado, patrón o usuario configurador no existe en este hospital',
};

const MENSAJES_ERROR_TURNO = {
  duplicado: 'Ya existe un turno con ese nombre en este hospital',
  enUso: 'El registro está asociado a otros registros y no se puede eliminar',
  referenciaInvalida: 'La empresa, el usuario o el turno indicado no existe en este hospital',
};

const MENSAJES_ERROR_PATRON = {
  duplicado: 'Ya existe un patrón con ese nombre en este hospital',
  enUso: 'El patrón está asociado a otros registros y no se puede eliminar',
  referenciaInvalida: 'La empresa, el usuario o el turno indicado no existe en este hospital',
};

/** Normaliza una fecha devuelta por MySQL al formato calendario YYYY-MM-DD. */
function normalizarFechaBD(fecha: string | Date): string {
  return fecha instanceof Date
    ? fecha.toISOString().slice(0, 10)
    : String(fecha).slice(0, 10);
}

/** Convierte una fila SQL al modelo de dominio de una asignación. */
function mapearAsignacion(fila: FilaAsignacion): AsignacionJornada {
  return {
    id: Number(fila.id),
    usuarioId: Number(fila.usuario_id),
    patronId: Number(fila.patron_id),
    fechaInicio: normalizarFechaBD(fila.fecha_inicio),
    fechaFin: fila.fecha_fin === null ? null : normalizarFechaBD(fila.fecha_fin),
    fechaReferencia: normalizarFechaBD(fila.fecha_referencia),
    configuradoPorId: Number(fila.configurado_por_id),
  };
}

/** Convierte una fila de MySQL al modelo de dominio del turno. */
function mapearTurno(fila: FilaTurno): TurnoJornada {
  return {
    id: Number(fila.id),
    nombre: fila.nombre,
    horaInicio: fila.hora_inicio,
    horaFin: fila.hora_fin,
    minutosDescanso: Number(fila.minutos_descanso),
    activo: Boolean(fila.activo),
  };
}

/** Convierte una fila SQL al modelo de dominio de un día del patrón. */
function mapearDiaPatron(fila: FilaDiaPatron): DiaPatronJornada {
  return {
    id: Number(fila.id),
    diaCiclo: Number(fila.dia_ciclo),
    tipoDia: fila.tipo_dia,
    turnoId: fila.turno_id === null ? null : Number(fila.turno_id),
  };
}

/** Recupera los días de un patrón y los ordena según la posición del ciclo. */
async function obtenerDiasPatron(
  conexion: Pick<IBaseDatos, never> & {
    consultar<T extends object>(sql: string, valores?: readonly (string | number | boolean | Date | Buffer | null)[]): Promise<T[]>;
  },
  empresaId: number,
  patronId: number,
): Promise<DiaPatronJornada[]> {
  const filas = await conexion.consultar<FilaDiaPatron>(
    `SELECT id, dia_ciclo, tipo_dia, turno_id
     FROM patrones_jornada_detalle
     WHERE empresa_id = ? AND patron_id = ?
     ORDER BY dia_ciclo ASC`,
    [empresaId, patronId],
  );

  return filas.map(mapearDiaPatron);
}

/** Convierte los datos del patrón y sus días al modelo de dominio. */
async function mapearPatron(
  conexion: Parameters<Parameters<IBaseDatos['transaccion']>[0]>[0],
  fila: FilaPatron,
  empresaId: number,
): Promise<PatronJornada> {
  return {
    id: Number(fila.id),
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    cicloDias: Number(fila.ciclo_dias),
    activo: Boolean(fila.activo),
    dias: await obtenerDiasPatron(conexion, empresaId, Number(fila.id)),
  };
}

export class JornadasRepository implements IJornadasRepository {
  constructor(private readonly bd: IBaseDatos) {}

  /** Obtiene un turno únicamente si pertenece a la empresa solicitante. */
  async obtenerTurno(empresaId: number, turnoId: number): Promise<TurnoJornada | null> {
    try {
      const filas = await this.bd.consultar<FilaTurno>(
        `SELECT id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
         FROM turnos
         WHERE empresa_id = ? AND id = ?
         LIMIT 1`,
        [empresaId, turnoId],
      );

      return filas.length > 0 ? mapearTurno(filas[0]!) : null;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_TURNO);
    }
  }

  /** Lista los turnos de una empresa y excluye los inactivos por defecto. */
  async listarTurnos(empresaId: number, incluirInactivos = false): Promise<TurnoJornada[]> {
    try {
      const condicionActivo = incluirInactivos ? '' : 'AND activo = 1';
      const filas = await this.bd.consultar<FilaTurno>(
        `SELECT id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
         FROM turnos
         WHERE empresa_id = ? ${condicionActivo}
         ORDER BY nombre ASC, id ASC`,
        [empresaId],
      );

      return filas.map(mapearTurno);
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_TURNO);
    }
  }

  /** Crea el turno y su registro de auditoría dentro de una misma transacción. */
  async crearTurno(
    empresaId: number,
    usuarioId: number,
    datos: DatosNuevoTurno,
  ): Promise<TurnoJornada> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        const resultado = await conexion.ejecutar(
          `INSERT INTO turnos (
             empresa_id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
           ) VALUES (?, ?, ?, ?, ?, 1)`,
          [empresaId, datos.nombre, datos.horaInicio, datos.horaFin, datos.minutosDescanso],
        );

        const turnoId = resultado.idInsertado;

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'TURNO_CREADO', 'TURNO', ?, ?)`,
          [empresaId, usuarioId, turnoId, JSON.stringify({ despues: datos })],
        );

        const filas = await conexion.consultar<FilaTurno>(
          `SELECT id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
           FROM turnos
           WHERE empresa_id = ? AND id = ?
           LIMIT 1`,
          [empresaId, turnoId],
        );

        if (filas.length === 0) {
          throw AppError.noEncontrado('No se pudo recuperar el turno recién creado');
        }

        return mapearTurno(filas[0]!);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_TURNO);
    }
  }

  /** Actualiza un turno bloqueando su fila y registra los valores anteriores y nuevos. */
  async actualizarTurno(
    empresaId: number,
    usuarioId: number,
    turnoId: number,
    datos: DatosActualizarTurno,
  ): Promise<TurnoJornada> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        const filasAnteriores = await conexion.consultar<FilaTurno>(
          `SELECT id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
           FROM turnos
           WHERE empresa_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, turnoId],
        );

        if (filasAnteriores.length === 0) {
          throw AppError.noEncontrado('El turno no existe en este hospital');
        }

        const antes = mapearTurno(filasAnteriores[0]!);

        await conexion.ejecutar(
          `UPDATE turnos
           SET nombre = ?, hora_inicio = ?, hora_fin = ?,
               minutos_descanso = ?, activo = ?
           WHERE empresa_id = ? AND id = ?`,
          [
            datos.nombre,
            datos.horaInicio,
            datos.horaFin,
            datos.minutosDescanso,
            datos.activo ? 1 : 0,
            empresaId,
            turnoId,
          ],
        );

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'TURNO_ACTUALIZADO', 'TURNO', ?, ?)`,
          [empresaId, usuarioId, turnoId, JSON.stringify({ antes, despues: datos })],
        );

        const filasActualizadas = await conexion.consultar<FilaTurno>(
          `SELECT id, nombre, hora_inicio, hora_fin, minutos_descanso, activo
           FROM turnos
           WHERE empresa_id = ? AND id = ?
           LIMIT 1`,
          [empresaId, turnoId],
        );

        if (filasActualizadas.length === 0) {
          throw AppError.noEncontrado('No se pudo recuperar el turno actualizado');
        }

        return mapearTurno(filasActualizadas[0]!);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_TURNO);
    }
  }

  /** Obtiene un patrón y sus días únicamente si pertenece a la empresa solicitante. */
  async obtenerPatron(empresaId: number, patronId: number): Promise<PatronJornada | null> {
    try {
      const filas = await this.bd.consultar<FilaPatron>(
        `SELECT id, nombre, descripcion, ciclo_dias, activo
         FROM patrones_jornada
         WHERE empresa_id = ? AND id = ?
         LIMIT 1`,
        [empresaId, patronId],
      );

      return filas.length > 0
        ? await mapearPatron(this.bd, filas[0]!, empresaId)
        : null;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_PATRON);
    }
  }

  /** Lista los patrones de una empresa y permite incluir los inactivos. */
  async listarPatrones(
    empresaId: number,
    incluirInactivos = false,
  ): Promise<PatronJornada[]> {
    try {
      const condicionActivo = incluirInactivos ? '' : 'AND activo = 1';
      const filas = await this.bd.consultar<FilaPatron>(
        `SELECT id, nombre, descripcion, ciclo_dias, activo
         FROM patrones_jornada
         WHERE empresa_id = ? ${condicionActivo}
         ORDER BY nombre ASC, id ASC`,
        [empresaId],
      );

      return Promise.all(filas.map((fila) => mapearPatron(this.bd, fila, empresaId)));
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_PATRON);
    }
  }

  /** Crea el patrón, sus días y la auditoría dentro de una única transacción. */
  async crearPatron(
    empresaId: number,
    usuarioId: number,
    datos: DatosNuevoPatron,
  ): Promise<PatronJornada> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        const resultado = await conexion.ejecutar(
          `INSERT INTO patrones_jornada (
             empresa_id, nombre, descripcion, ciclo_dias, activo
           ) VALUES (?, ?, ?, ?, 1)`,
          [empresaId, datos.nombre, datos.descripcion, datos.cicloDias],
        );

        const patronId = resultado.idInsertado;

        for (const dia of datos.dias) {
          await conexion.ejecutar(
            `INSERT INTO patrones_jornada_detalle (
               empresa_id, patron_id, dia_ciclo, tipo_dia, turno_id
             ) VALUES (?, ?, ?, ?, ?)`,
            [empresaId, patronId, dia.diaCiclo, dia.tipoDia, dia.turnoId],
          );
        }

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'PATRON_JORNADA_CREADO', 'PATRON_JORNADA', ?, ?)`,
          [
            empresaId,
            usuarioId,
            patronId,
            JSON.stringify({ despues: datos }),
          ],
        );

        const filas = await conexion.consultar<FilaPatron>(
          `SELECT id, nombre, descripcion, ciclo_dias, activo
           FROM patrones_jornada
           WHERE empresa_id = ? AND id = ?
           LIMIT 1`,
          [empresaId, patronId],
        );

        if (filas.length === 0) {
          throw AppError.noEncontrado('No se pudo recuperar el patrón recién creado');
        }

        return mapearPatron(conexion, filas[0]!, empresaId);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_PATRON);
    }
  }

  /** Crea una asignación vigente sin permitir solapamientos para el empleado. */
  async crearAsignacion(
    empresaId: number,
    usuarioId: number,
    datos: DatosNuevaAsignacion,
  ): Promise<AsignacionJornada> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        // Bloquea al empleado para serializar las altas concurrentes de jornadas.
        const empleados = await conexion.consultar<{ id: number }>(
          `SELECT id
           FROM usuarios
           WHERE empresa_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, datos.usuarioId],
        );

        if (empleados.length === 0) {
          throw AppError.noEncontrado('El empleado no existe en este hospital');
        }

        const patrones = await conexion.consultar<{ id: number; activo: number | boolean }>(
          `SELECT id, activo
           FROM patrones_jornada
           WHERE empresa_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, datos.patronId],
        );

        if (patrones.length === 0) {
          throw AppError.noEncontrado('El patrón no existe en este hospital');
        }

        if (!patrones[0]!.activo) {
          throw AppError.reglaDeNegocio('No se puede asignar un patrón inactivo');
        }

        // Una asignación nueva no tiene fecha de cierre; por eso cualquier
        // asignación que termine en la fecha de inicio o después se solaparía.
        const existentes = await conexion.consultar<{ id: number }>(
          `SELECT id
           FROM asignaciones_jornada
           WHERE empresa_id = ?
             AND usuario_id = ?
             AND (fecha_fin IS NULL OR fecha_fin >= ?)
           LIMIT 1
           FOR UPDATE`,
          [empresaId, datos.usuarioId, datos.fechaInicio],
        );

        if (existentes.length > 0) {
          throw AppError.conflicto(
            'El empleado ya tiene una asignación de jornada que se solapa con la fecha indicada',
          );
        }

        const resultado = await conexion.ejecutar(
          `INSERT INTO asignaciones_jornada (
             empresa_id, usuario_id, patron_id, fecha_inicio,
             fecha_referencia, configurado_por_id
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            empresaId,
            datos.usuarioId,
            datos.patronId,
            datos.fechaInicio,
            datos.fechaReferencia,
            usuarioId,
          ],
        );

        const asignacionId = resultado.idInsertado;

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'JORNADA_ASIGNADA', 'ASIGNACION_JORNADA', ?, ?)`,
          [
            empresaId,
            usuarioId,
            asignacionId,
            JSON.stringify({ despues: datos }),
          ],
        );

        const filas = await conexion.consultar<FilaAsignacion>(
          `SELECT id, usuario_id, patron_id, fecha_inicio, fecha_fin,
                  fecha_referencia, configurado_por_id
           FROM asignaciones_jornada
           WHERE empresa_id = ? AND id = ?
           LIMIT 1`,
          [empresaId, asignacionId],
        );

        if (filas.length === 0) {
          throw AppError.noEncontrado('No se pudo recuperar la asignación recién creada');
        }

        return mapearAsignacion(filas[0]!);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_ASIGNACION);
    }
  }

  /** Cierra una asignación sin eliminar su historial y registra la auditoría. */
  async cerrarAsignacion(
    empresaId: number,
    usuarioId: number,
    datos: DatosCerrarAsignacion,
  ): Promise<AsignacionJornada> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        const filasAnteriores = await conexion.consultar<FilaAsignacion>(
          `SELECT id, usuario_id, patron_id, fecha_inicio, fecha_fin,
                  fecha_referencia, configurado_por_id
           FROM asignaciones_jornada
           WHERE empresa_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, datos.asignacionId],
        );

        if (filasAnteriores.length === 0) {
          throw AppError.noEncontrado('La asignación no existe en este hospital');
        }

        const anterior = mapearAsignacion(filasAnteriores[0]!);

        if (anterior.fechaFin !== null) {
          throw AppError.conflicto('La asignación ya está cerrada');
        }

        if (datos.fechaFin < anterior.fechaInicio) {
          throw AppError.validacion(
            'La fecha de cierre no puede ser anterior al inicio de la asignación',
          );
        }

        // Evita cerrar una asignación sobre fechas ocupadas por otra asignación.
        const solapamientos = await conexion.consultar<{ id: number }>(
          `SELECT id
           FROM asignaciones_jornada
           WHERE empresa_id = ?
             AND usuario_id = ?
             AND id <> ?
             AND fecha_inicio <= ?
             AND (fecha_fin IS NULL OR fecha_fin >= ?)
           LIMIT 1
           FOR UPDATE`,
          [
            empresaId,
            anterior.usuarioId,
            datos.asignacionId,
            datos.fechaFin,
            anterior.fechaInicio,
          ],
        );

        if (solapamientos.length > 0) {
          throw AppError.conflicto(
            'La fecha de cierre se solapa con otra asignación del empleado',
          );
        }

        await conexion.ejecutar(
          `UPDATE asignaciones_jornada
           SET fecha_fin = ?
           WHERE empresa_id = ? AND id = ? AND fecha_fin IS NULL`,
          [datos.fechaFin, empresaId, datos.asignacionId],
        );

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'JORNADA_ASIGNACION_CERRADA', 'ASIGNACION_JORNADA', ?, ?)`,
          [
            empresaId,
            usuarioId,
            datos.asignacionId,
            JSON.stringify({ antes: anterior, despues: datos }),
          ],
        );

        const filasActualizadas = await conexion.consultar<FilaAsignacion>(
          `SELECT id, usuario_id, patron_id, fecha_inicio, fecha_fin,
                  fecha_referencia, configurado_por_id
           FROM asignaciones_jornada
           WHERE empresa_id = ? AND id = ?
           LIMIT 1`,
          [empresaId, datos.asignacionId],
        );

        if (filasActualizadas.length === 0) {
          throw AppError.noEncontrado('No se pudo recuperar la asignación cerrada');
        }

        return mapearAsignacion(filasActualizadas[0]!);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_ASIGNACION);
    }
  }

  /** Recupera la asignación que cubre una fecha concreta del empleado. */
  async obtenerAsignacionParaFecha(
    empresaId: number,
    usuarioId: number,
    fecha: string,
  ): Promise<AsignacionJornada | null> {
    try {
      const filas = await this.bd.consultar<FilaAsignacion>(
        `SELECT id, usuario_id, patron_id, fecha_inicio, fecha_fin,
                fecha_referencia, configurado_por_id
         FROM asignaciones_jornada
         WHERE empresa_id = ?
           AND usuario_id = ?
           AND fecha_inicio <= ?
           AND (fecha_fin IS NULL OR fecha_fin >= ?)
         ORDER BY fecha_inicio DESC, id DESC
         LIMIT 1`,
        [empresaId, usuarioId, fecha, fecha],
      );

      return filas.length > 0 ? mapearAsignacion(filas[0]!) : null;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR_ASIGNACION);
    }
  }}



