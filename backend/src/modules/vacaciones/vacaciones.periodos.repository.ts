// Acceso a datos de los periodos de vacaciones y de los dias que da cada area o persona. Solo SQL parametrizado
// y siempre filtrado por empresa_id. El service depende de IPeriodosRepository, no de esta clase.
import type { IBaseDatos, IConexionBD } from '../../config/database';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import type { PeriodoNuevo } from './vacaciones.periodos';

// Lo que hace falta de una persona para crear sus periodos y saber cuantos dias le tocan
export interface DatosDePeriodos {
  areaId: number;
  fechaIngreso: string;
  // Dias propios de la persona; null si no tiene y le toca lo de su area
  diasVacaciones: number | null;
}

// Dias propios de un area dentro de su cadena hacia la raiz: nivel 0 es el area misma, 1 su area padre, y asi
export interface DiasDeArea {
  nivel: number;
  diasVacaciones: number | null;
}

export interface IPeriodosRepository {
  // null si la persona no existe en ese hospital
  buscarDatosDePeriodos: (empresaId: number, usuarioId: number) => Promise<DatosDePeriodos | null>;
  // Vacia si el area no existe en ese hospital
  listarDiasDeCadenaDeAreas: (empresaId: number, areaId: number) => Promise<DiasDeArea[]>;
  // Crea los periodos que no existan; los que ya estan no se tocan (se reconocen por persona y fecha de inicio)
  crearPeriodosFaltantes: (
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
    diasDerecho: number,
  ) => Promise<void>;
  // Fijan (o quitan, con null) los dias propios y dejan constancia en la bitacora; false si no existe en ese hospital
  fijarDiasDeArea: (empresaId: number, areaId: number, dias: number | null, actorId: number) => Promise<boolean>;
  fijarDiasDePersona: (empresaId: number, usuarioId: number, dias: number | null, actorId: number) => Promise<boolean>;
}

interface FilaDatos {
  areaId: number;
  fechaIngreso: string;
  diasVacaciones: string | number | null;
}

interface FilaDiasDeArea {
  nivel: number;
  diasVacaciones: string | number | null;
}

const MENSAJES: MensajesErrorBD = {
  referenciaInvalida: 'La persona indicada no existe en este hospital',
};

// Los DECIMAL llegan como texto desde mysql2
function aNumeroONulo(valor: string | number | null): number | null {
  return valor === null ? null : Number.parseFloat(String(valor));
}

// Deja en la bitacora quien cambio los dias y de cuanto a cuanto
async function dejarConstancia(
  conexion: IConexionBD,
  empresaId: number,
  actorId: number,
  entidad: 'areas' | 'usuarios',
  entidadId: number,
  antes: number | null,
  despues: number | null,
): Promise<void> {
  await conexion.ejecutar(
    `INSERT INTO audit_log (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
     VALUES (?, ?, 'CAMBIO_DIAS_VACACIONES', ?, ?, ?)`,
    [empresaId, actorId, entidad, entidadId, JSON.stringify({ antes, despues })],
  );
}

export class PeriodosRepository implements IPeriodosRepository {
  constructor(private readonly bd: IBaseDatos) {}

  async buscarDatosDePeriodos(empresaId: number, usuarioId: number): Promise<DatosDePeriodos | null> {
    const [fila] = await this.bd.consultar<FilaDatos>(
      `SELECT area_id AS areaId, fecha_ingreso AS fechaIngreso, dias_vacaciones AS diasVacaciones
       FROM usuarios WHERE empresa_id = ? AND id = ? LIMIT 1`,
      [empresaId, usuarioId],
    );
    if (!fila) {
      return null;
    }
    return {
      areaId: fila.areaId,
      fechaIngreso: fila.fechaIngreso,
      diasVacaciones: aNumeroONulo(fila.diasVacaciones),
    };
  }

  async listarDiasDeCadenaDeAreas(empresaId: number, areaId: number): Promise<DiasDeArea[]> {
    // Sube desde el area por area_padre hasta la raiz, siempre dentro del mismo hospital
    const filas = await this.bd.consultar<FilaDiasDeArea>(
      `WITH RECURSIVE cadena (id, parent_id, dias_vacaciones, nivel) AS (
         SELECT id, parent_id, dias_vacaciones, 0 FROM areas WHERE empresa_id = ? AND id = ?
         UNION ALL
         SELECT a.id, a.parent_id, a.dias_vacaciones, c.nivel + 1
         FROM areas a INNER JOIN cadena c ON a.id = c.parent_id
         WHERE a.empresa_id = ?
       )
       SELECT nivel, dias_vacaciones AS diasVacaciones FROM cadena ORDER BY nivel`,
      [empresaId, areaId, empresaId],
    );
    return filas.map((fila) => ({
      nivel: Number(fila.nivel),
      diasVacaciones: aNumeroONulo(fila.diasVacaciones),
    }));
  }

  async crearPeriodosFaltantes(
    empresaId: number,
    usuarioId: number,
    periodos: PeriodoNuevo[],
    diasDerecho: number,
  ): Promise<void> {
    try {
      for (const periodo of periodos) {
        // Si el periodo ya existe (o dos solicitudes lo crean a la vez) no se cambia nada: ni los dias ni lo usado
        await this.bd.ejecutar(
          `INSERT INTO periodos_vacaciones (empresa_id, usuario_id, fecha_inicio, fecha_caducidad, dias_derecho)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE dias_derecho = dias_derecho`,
          [empresaId, usuarioId, periodo.fechaInicio, periodo.fechaCaducidad, diasDerecho],
        );
      }
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  fijarDiasDeArea(empresaId: number, areaId: number, dias: number | null, actorId: number): Promise<boolean> {
    return this.bd.transaccion(async (conexion) => {
      const [area] = await conexion.consultar<{ diasVacaciones: string | number | null }>(
        'SELECT dias_vacaciones AS diasVacaciones FROM areas WHERE empresa_id = ? AND id = ? FOR UPDATE',
        [empresaId, areaId],
      );
      if (!area) {
        return false;
      }
      await conexion.ejecutar('UPDATE areas SET dias_vacaciones = ? WHERE empresa_id = ? AND id = ?', [
        dias,
        empresaId,
        areaId,
      ]);
      await dejarConstancia(conexion, empresaId, actorId, 'areas', areaId, aNumeroONulo(area.diasVacaciones), dias);
      return true;
    });
  }

  fijarDiasDePersona(empresaId: number, usuarioId: number, dias: number | null, actorId: number): Promise<boolean> {
    return this.bd.transaccion(async (conexion) => {
      const [persona] = await conexion.consultar<{ diasVacaciones: string | number | null }>(
        'SELECT dias_vacaciones AS diasVacaciones FROM usuarios WHERE empresa_id = ? AND id = ? FOR UPDATE',
        [empresaId, usuarioId],
      );
      if (!persona) {
        return false;
      }
      await conexion.ejecutar('UPDATE usuarios SET dias_vacaciones = ? WHERE empresa_id = ? AND id = ?', [
        dias,
        empresaId,
        usuarioId,
      ]);
      await dejarConstancia(
        conexion,
        empresaId,
        actorId,
        'usuarios',
        usuarioId,
        aNumeroONulo(persona.diasVacaciones),
        dias,
      );
      return true;
    });
  }
}