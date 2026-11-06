// Repositorio de delegaciones institucionales.
// Gestiona consultas, vigencia, concurrencia y auditoria por hospital.

import type { IBaseDatos, IConexionBD } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import type {
  Delegacion,
  EstadoDelegacion,
  FiltrosDelegaciones,
  IDelegacionesRepository,
  PersonaDelegacion,
  ResultadoListaDelegaciones,
} from './delegaciones.dominio';

interface FilaDelegacion {
  id: number;
  deleganteId: number;
  deleganteNombres: string;
  deleganteApellidos: string;
  delegadoId: number;
  delegadoNombres: string;
  delegadoApellidos: string;
  creadaPorId: number;
  vigenteDesde: Date;
  vigenteHasta: Date;
  motivo: string | null;
  revocadaAt: Date | null;
  creadaAt: Date;
  estado: EstadoDelegacion;
}

interface FilaUsuario {
  id: number;
}

const MENSAJES_ERROR: MensajesErrorBD = {
  duplicado: 'Ya existe una delegacion incompatible para este responsable',
  referenciaInvalida: 'El delegante o el delegado no existe o no pertenece a este hospital',
};

const SQL_DELEGACIONES = `
  SELECT
    d.id AS id,
    d.delegante_id AS deleganteId,
    delegante.nombres AS deleganteNombres,
    delegante.apellidos AS deleganteApellidos,
    d.delegado_id AS delegadoId,
    delegado.nombres AS delegadoNombres,
    delegado.apellidos AS delegadoApellidos,
    d.creada_por_id AS creadaPorId,
    d.vigente_desde AS vigenteDesde,
    d.vigente_hasta AS vigenteHasta,
    d.motivo AS motivo,
    d.revocada_at AS revocadaAt,
    d.created_at AS creadaAt,
    CASE
      WHEN d.revocada_at IS NOT NULL THEN 'REVOCADA'
      WHEN d.vigente_hasta <= UTC_TIMESTAMP() THEN 'VENCIDA'
      WHEN d.vigente_desde > UTC_TIMESTAMP() THEN 'PROGRAMADA'
      ELSE 'VIGENTE'
    END AS estado
  FROM delegaciones d
  INNER JOIN usuarios delegante
    ON delegante.empresa_id = d.empresa_id
   AND delegante.id = d.delegante_id
  INNER JOIN usuarios delegado
    ON delegado.empresa_id = d.empresa_id
   AND delegado.id = d.delegado_id
`;

function mapearDelegacion(fila: FilaDelegacion): Delegacion {
  const delegante: PersonaDelegacion = {
    id: fila.deleganteId,
    nombres: fila.deleganteNombres,
    apellidos: fila.deleganteApellidos,
  };

  const delegado: PersonaDelegacion = {
    id: fila.delegadoId,
    nombres: fila.delegadoNombres,
    apellidos: fila.delegadoApellidos,
  };

  return {
    id: fila.id,
    delegante,
    delegado,
    creadaPorId: fila.creadaPorId,
    vigenteDesde: fila.vigenteDesde,
    vigenteHasta: fila.vigenteHasta,
    motivo: fila.motivo,
    revocadaAt: fila.revocadaAt,
    estado: fila.estado,
    creadaAt: fila.creadaAt,
  };
}

// Bloquea usuarios en orden estable para reducir conflictos entre transacciones concurrentes.
async function bloquearUsuarios(
  conexion: IConexionBD,
  empresaId: number,
  ids: number[],
): Promise<Set<number>> {
  const encontrados = new Set<number>();

  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    const [usuario] = await conexion.consultar<FilaUsuario>(
      `SELECT id
       FROM usuarios
       WHERE empresa_id = ? AND id = ? AND estado = 'ACTIVO'
       FOR UPDATE`,
      [empresaId, id],
    );

    if (usuario) {
      encontrados.add(usuario.id);
    }
  }

  return encontrados;
}

export class DelegacionesRepository implements IDelegacionesRepository {
  constructor(private readonly bd: IBaseDatos) {}

  // Lista delegaciones de un hospital, aplicando filtros y paginacion.
  async listar(
    empresaId: number,
    filtros: FiltrosDelegaciones,
  ): Promise<ResultadoListaDelegaciones> {
    const condiciones = ['d.empresa_id = ?'];
    const valores: (number | string)[] = [empresaId];

    if (filtros.deleganteId !== undefined) {
      condiciones.push('d.delegante_id = ?');
      valores.push(filtros.deleganteId);
    }

    if (filtros.delegadoId !== undefined) {
      condiciones.push('d.delegado_id = ?');
      valores.push(filtros.delegadoId);
    }

    if (filtros.estado !== undefined) {
      condiciones.push(`
        CASE
          WHEN d.revocada_at IS NOT NULL THEN 'REVOCADA'
          WHEN d.vigente_hasta <= UTC_TIMESTAMP() THEN 'VENCIDA'
          WHEN d.vigente_desde > UTC_TIMESTAMP() THEN 'PROGRAMADA'
          ELSE 'VIGENTE'
        END = ?
      `);
      valores.push(filtros.estado);
    }

    const where = condiciones.join(' AND ');
    const limite = Math.trunc(filtros.porPagina);
    const desplazamiento = (Math.trunc(filtros.pagina) - 1) * limite;

    const [filas, conteo] = await Promise.all([
      this.bd.consultar<FilaDelegacion>(
        `${SQL_DELEGACIONES}
         WHERE ${where}
         ORDER BY d.vigente_desde DESC, d.id DESC
         LIMIT ${limite} OFFSET ${desplazamiento}`,
        valores,
      ),
      this.bd.consultar<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM delegaciones d
         WHERE ${where}`,
        valores,
      ),
    ]);

    return {
      delegaciones: filas.map(mapearDelegacion),
      total: Number(conteo[0]?.total ?? 0),
    };
  }

  // Obtiene una delegacion sin permitir referencias a otro hospital.
  async obtener(empresaId: number, delegacionId: number): Promise<Delegacion | null> {
    const [fila] = await this.bd.consultar<FilaDelegacion>(
      `${SQL_DELEGACIONES}
       WHERE d.empresa_id = ? AND d.id = ?
       LIMIT 1`,
      [empresaId, delegacionId],
    );

    return fila ? mapearDelegacion(fila) : null;
  }

  // Registra la delegacion y su auditoria en una unica transaccion.
  async crear(
    empresaId: number,
    actorId: number,
    datos: {
      deleganteId: number;
      delegadoId: number;
      vigenteDesde: Date;
      vigenteHasta: Date;
      motivo: string | null;
    },
  ): Promise<Delegacion> {
    try {
      const id = await this.bd.transaccion(async (conexion) => {
        const usuariosActivos = await bloquearUsuarios(conexion, empresaId, [
          datos.deleganteId,
          datos.delegadoId,
        ]);

        if (
          !usuariosActivos.has(datos.deleganteId) ||
          !usuariosActivos.has(datos.delegadoId)
        ) {
          throw AppError.reglaDeNegocio(
            'El delegante y el delegado deben existir y estar activos en este hospital',
          );
        }

        if (datos.deleganteId === datos.delegadoId) {
          throw AppError.reglaDeNegocio(
            'Una persona no puede delegar sus atribuciones en si misma',
          );
        }

        const superposiciones = await conexion.consultar<{ id: number }>(
          `SELECT id
           FROM delegaciones
           WHERE empresa_id = ?
             AND delegante_id = ?
             AND revocada_at IS NULL
             AND vigente_desde < ?
             AND vigente_hasta > ?
           LIMIT 1
           FOR UPDATE`,
          [
            empresaId,
            datos.deleganteId,
            datos.vigenteHasta,
            datos.vigenteDesde,
          ],
        );

        if (superposiciones.length > 0) {
          throw AppError.reglaDeNegocio(
            'El responsable ya tiene una delegacion registrada para ese periodo',
          );
        }

        const resultado = await conexion.ejecutar(
          `INSERT INTO delegaciones (
             empresa_id,
             delegante_id,
             delegado_id,
             vigente_desde,
             vigente_hasta,
             creada_por_id,
             motivo
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            empresaId,
            datos.deleganteId,
            datos.delegadoId,
            datos.vigenteDesde,
            datos.vigenteHasta,
            actorId,
            datos.motivo,
          ],
        );

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'CREACION_DELEGACION', 'DELEGACION', ?, ?)`,
          [
            empresaId,
            actorId,
            resultado.idInsertado,
            JSON.stringify({
              deleganteId: datos.deleganteId,
              delegadoId: datos.delegadoId,
              vigenteDesde: datos.vigenteDesde,
              vigenteHasta: datos.vigenteHasta,
              motivo: datos.motivo,
            }),
          ],
        );

        return resultado.idInsertado;
      });

      const delegacion = await this.obtener(empresaId, id);

      if (!delegacion) {
        throw AppError.noEncontrado(
          'No se pudo recuperar la delegacion registrada',
        );
      }

      return delegacion;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR);
    }
  }

  // Revoca una delegacion y conserva su registro historico.
  async revocar(
    empresaId: number,
    delegacionId: number,
    actorId: number,
    revocadaAt: Date,
  ): Promise<Delegacion> {
    try {
      await this.bd.transaccion(async (conexion) => {
        const [delegacion] = await conexion.consultar<{
          id: number;
          revocadaAt: Date | null;
        }>(
          `SELECT id, revocada_at AS revocadaAt
           FROM delegaciones
           WHERE empresa_id = ? AND id = ?
           FOR UPDATE`,
          [empresaId, delegacionId],
        );

        if (!delegacion) {
          throw AppError.noEncontrado('La delegacion no existe en este hospital');
        }

        if (delegacion.revocadaAt !== null) {
          throw AppError.reglaDeNegocio('La delegacion ya fue revocada');
        }

        await conexion.ejecutar(
          `UPDATE delegaciones
           SET revocada_at = ?
           WHERE empresa_id = ? AND id = ? AND revocada_at IS NULL`,
          [revocadaAt, empresaId, delegacionId],
        );

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'REVOCACION_DELEGACION', 'DELEGACION', ?, ?)`,
          [
            empresaId,
            actorId,
            delegacionId,
            JSON.stringify({ revocadaAt }),
          ],
        );
      });

      const delegacionActualizada = await this.obtener(empresaId, delegacionId);

      if (!delegacionActualizada) {
        throw AppError.noEncontrado(
          'No se pudo recuperar la delegacion revocada',
        );
      }

      return delegacionActualizada;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR);
    }
  }
}