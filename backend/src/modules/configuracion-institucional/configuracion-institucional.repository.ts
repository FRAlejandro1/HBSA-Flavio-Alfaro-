// Repositorio de configuracion institucional.
// Gestiona los parametros por hospital y registra cada modificacion en auditoria.

import type { IBaseDatos } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import type {
  ConfiguracionInstitucional,
  DatosActualizarConfiguracionInstitucional,
  IConfiguracionInstitucionalRepository,
} from './configuracion-institucional.dominio';

interface FilaConfiguracion {
  plazoHoras: string | number;
  diasVacacionesAnuales: string | number;
  zonaHoraria: string;
  diasAnticipacionVacaciones: number | string;
}

const MENSAJES_ERROR: MensajesErrorBD = {
  referenciaInvalida: 'La configuracion institucional no existe para este hospital',
};

// Convierte los valores DECIMAL de MySQL a numeros del dominio.
function mapearConfiguracion(fila: FilaConfiguracion): ConfiguracionInstitucional {
  return {
    plazoHoras: Number(fila.plazoHoras),
    diasVacacionesAnuales: Number(fila.diasVacacionesAnuales),
    zonaHoraria: fila.zonaHoraria,
    diasAnticipacionVacaciones: Number(fila.diasAnticipacionVacaciones),
  };
}

export class ConfiguracionInstitucionalRepository
  implements IConfiguracionInstitucionalRepository
{
  constructor(private readonly bd: IBaseDatos) {}

  // Obtiene los parametros correspondientes exclusivamente al hospital indicado.
  async obtener(empresaId: number): Promise<ConfiguracionInstitucional | null> {
    const [fila] = await this.bd.consultar<FilaConfiguracion>(
      `SELECT
         plazo_horas AS plazoHoras,
         dias_vacaciones_anuales AS diasVacacionesAnuales,
         zona_horaria AS zonaHoraria,
         dias_anticipacion_vacaciones AS diasAnticipacionVacaciones
       FROM config_aprobacion
       WHERE empresa_id = ?
       LIMIT 1`,
      [empresaId],
    );

    return fila ? mapearConfiguracion(fila) : null;
  }

  // Actualiza los parametros y registra los valores anteriores y nuevos en una transaccion.
  async actualizar(
    empresaId: number,
    actorId: number,
    datos: DatosActualizarConfiguracionInstitucional,
  ): Promise<ConfiguracionInstitucional> {
    try {
      return await this.bd.transaccion(async (conexion) => {
        const filasAnteriores = await conexion.consultar<FilaConfiguracion>(
          `SELECT
             plazo_horas AS plazoHoras,
             dias_vacaciones_anuales AS diasVacacionesAnuales,
             zona_horaria AS zonaHoraria,
             dias_anticipacion_vacaciones AS diasAnticipacionVacaciones
           FROM config_aprobacion
           WHERE empresa_id = ?
           FOR UPDATE`,
          [empresaId],
        );

        if (filasAnteriores.length === 0) {
          throw AppError.noEncontrado(
            'La configuracion institucional no existe para este hospital',
          );
        }

        const antes = mapearConfiguracion(filasAnteriores[0]!);

        await conexion.ejecutar(
          `UPDATE config_aprobacion
           SET plazo_horas = ?,
               dias_vacaciones_anuales = ?,
               zona_horaria = ?,
               dias_anticipacion_vacaciones = ?
           WHERE empresa_id = ?`,
          [
            datos.plazoHoras,
            datos.diasVacacionesAnuales,
            datos.zonaHoraria,
            datos.diasAnticipacionVacaciones,
            empresaId,
          ],
        );

        await conexion.ejecutar(
          `INSERT INTO audit_log (
             empresa_id, usuario_id, accion, entidad, entidad_id, detalle
           ) VALUES (?, ?, 'ACTUALIZACION_CONFIG_INSTITUCIONAL', 'CONFIG_APROBACION', ?, ?)`,
          [empresaId, actorId, empresaId, JSON.stringify({ antes, despues: datos })],
        );

        const [filaActualizada] = await conexion.consultar<FilaConfiguracion>(
          `SELECT
             plazo_horas AS plazoHoras,
             dias_vacaciones_anuales AS diasVacacionesAnuales,
             zona_horaria AS zonaHoraria,
             dias_anticipacion_vacaciones AS diasAnticipacionVacaciones
           FROM config_aprobacion
           WHERE empresa_id = ?
           LIMIT 1`,
          [empresaId],
        );

        if (!filaActualizada) {
          throw AppError.noEncontrado(
            'No se pudo recuperar la configuracion institucional actualizada',
          );
        }

        return mapearConfiguracion(filaActualizada);
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_ERROR);
    }
  }
}