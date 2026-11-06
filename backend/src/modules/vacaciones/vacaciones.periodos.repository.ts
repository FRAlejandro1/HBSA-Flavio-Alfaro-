// Acceso a datos de los periodos de vacaciones. Recupera la configuración
// individual y del área, siempre aislada por empresa_id.
import type { IBaseDatos } from '../../config/database';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import type { PeriodoNuevo } from './vacaciones.periodos';

// Datos necesarios para calcular los periodos y resolver los días de derecho.
export interface DatosDePeriodos {
  fechaIngreso: string;
  diasVacacionesPersona: number | null;
  diasVacacionesArea: number | null;
}

export interface IPeriodosRepository {
  // Devuelve null si la persona no existe en ese hospital.
  buscarDatosDePeriodos: (empresaId: number, usuarioId: number) => Promise<DatosDePeriodos | null>;

  // Devuelve únicamente los periodos que todavía no existen en el hospital.
  filtrarPeriodosFaltantes: (
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
  ) => Promise<PeriodoNuevo[]>;

  // Crea los periodos que no existan; los existentes conservan sus días y consumo.
  crearPeriodosFaltantes: (
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
    diasDerecho: number,
  ) => Promise<void>;
}

interface FilaDatos {
  fechaIngreso: string;
  diasVacacionesPersona: number | string | null;
  diasVacacionesArea: number | string | null;
}

const MENSAJES: MensajesErrorBD = {
  referenciaInvalida: 'La persona indicada no existe en este hospital',
};

export class PeriodosRepository implements IPeriodosRepository {
  constructor(private readonly bd: IBaseDatos) {}

  async buscarDatosDePeriodos(empresaId: number, usuarioId: number): Promise<DatosDePeriodos | null> {
    const [fila] = await this.bd.consultar<FilaDatos>(
      `SELECT
         u.fecha_ingreso AS fechaIngreso,
         u.dias_vacaciones AS diasVacacionesPersona,
         a.dias_vacaciones AS diasVacacionesArea
       FROM usuarios u
       INNER JOIN areas a
         ON a.empresa_id = u.empresa_id
        AND a.id = u.area_id
       WHERE u.empresa_id = ?
         AND u.id = ?
       LIMIT 1`,
      [empresaId, usuarioId],
    );

    if (!fila) {
      return null;
    }

    return {
      fechaIngreso: fila.fechaIngreso,
      diasVacacionesPersona: fila.diasVacacionesPersona === null
        ? null
        : Number(fila.diasVacacionesPersona),
      diasVacacionesArea: fila.diasVacacionesArea === null
        ? null
        : Number(fila.diasVacacionesArea),
    };
  }

  async filtrarPeriodosFaltantes(
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
  ): Promise<PeriodoNuevo[]> {
    if (periodos.length === 0) {
      return [];
    }

    try {
      const fechas = periodos.map((periodo) => periodo.fechaInicio);
      const marcadores = fechas.map(() => '?').join(', ');

      const existentes = await this.bd.consultar<{ fechaInicio: string }>(
        `SELECT DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fechaInicio
         FROM periodos_vacaciones
         WHERE empresa_id = ?
           AND usuario_id = ?
           AND fecha_inicio IN (${marcadores})`,
        [empresaId, usuarioId, ...fechas],
      );

      const fechasExistentes = new Set(existentes.map((fila) => fila.fechaInicio));

      return periodos.filter((periodo) => !fechasExistentes.has(periodo.fechaInicio));
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async crearPeriodosFaltantes(
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
    diasDerecho: number,
  ): Promise<void> {
    try {
      for (const periodo of periodos) {
        // Si el periodo ya existe, no se modifican sus días ni los días utilizados.
        await this.bd.ejecutar(
          `INSERT INTO periodos_vacaciones (
             empresa_id, usuario_id, fecha_inicio, fecha_caducidad, dias_derecho
           )
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE dias_derecho = dias_derecho`,
          [empresaId, usuarioId, periodo.fechaInicio, periodo.fechaCaducidad, diasDerecho],
        );
      }
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }
}