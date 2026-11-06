// Servicio de configuracion institucional.
// Valida los parametros del hospital y coordina su consulta y actualizacion.

import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type {
  ConfiguracionInstitucional,
  DatosActualizarConfiguracionInstitucional,
  IConfiguracionInstitucionalRepository,
} from './configuracion-institucional.dominio';
import { esquemaActualizarConfiguracionInstitucional } from './configuracion-institucional.validators';

export interface DependenciasConfiguracionInstitucionalService {
  repositorio: IConfiguracionInstitucionalRepository;
}

export class ConfiguracionInstitucionalService {
  constructor(private readonly deps: DependenciasConfiguracionInstitucionalService) {}

  // Consulta la configuracion correspondiente al hospital autenticado.
  async obtener(actor: UsuarioAutenticado): Promise<ConfiguracionInstitucional> {
    const configuracion = await this.deps.repositorio.obtener(actor.empresaId);

    if (configuracion === null) {
      throw AppError.noEncontrado(
        'No existe configuracion institucional para este hospital',
      );
    }

    return configuracion;
  }

  // Valida y actualiza los parametros, registrando al SUPERADMIN que realiza el cambio.
  async actualizar(
    actor: UsuarioAutenticado,
    datos: DatosActualizarConfiguracionInstitucional,
  ): Promise<ConfiguracionInstitucional> {
    const resultado = esquemaActualizarConfiguracionInstitucional.safeParse(datos);

    if (!resultado.success) {
      throw AppError.validacion(
        'Los parametros de configuracion institucional no son validos',
        resultado.error.flatten(),
      );
    }

    return this.deps.repositorio.actualizar(
      actor.empresaId,
      actor.id,
      resultado.data,
    );
  }
}