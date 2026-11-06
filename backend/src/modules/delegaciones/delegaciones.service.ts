// Servicio de delegaciones institucionales.
// Aplica permisos, vigencia y reglas de negocio antes de acceder al repositorio.

import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type {
  Delegacion,
  DatosCrearDelegacion,
  FiltrosDelegaciones,
  IDelegacionesRepository,
  ResultadoListaDelegaciones,
} from './delegaciones.dominio';

export interface DependenciasDelegacionesService {
  repositorio: IDelegacionesRepository;
  ahora?: () => Date;
}

export class DelegacionesService {
  private readonly ahora: () => Date;

  constructor(private readonly deps: DependenciasDelegacionesService) {
    this.ahora = deps.ahora ?? (() => new Date());
  }

  // Solo jefes de area y SUPERADMIN pueden consultar la administracion de delegaciones.
  async listar(
    actor: UsuarioAutenticado,
    filtros: FiltrosDelegaciones,
  ): Promise<ResultadoListaDelegaciones> {
    if (actor.rol !== 'JEFE_AREA' && actor.rol !== 'SUPERADMIN') {
      throw AppError.prohibido();
    }

    // Un jefe solo consulta sus propias delegaciones; SUPERADMIN puede consultar todo el hospital.
    const filtrosAplicados: FiltrosDelegaciones =
      actor.rol === 'SUPERADMIN'
        ? filtros
        : { ...filtros, deleganteId: actor.id };

    return this.deps.repositorio.listar(actor.empresaId, filtrosAplicados);
  }

  // Obtiene una delegacion respetando la visibilidad del actor.
  async obtener(
    actor: UsuarioAutenticado,
    delegacionId: number,
  ): Promise<Delegacion> {
    this.exigirPermisoAdministracion(actor);

    const delegacion = await this.deps.repositorio.obtener(
      actor.empresaId,
      delegacionId,
    );

    if (!delegacion) {
      throw AppError.noEncontrado('La delegacion no existe en este hospital');
    }

    if (actor.rol !== 'SUPERADMIN' && delegacion.delegante.id !== actor.id) {
      throw AppError.prohibido();
    }

    return delegacion;
  }

  // El jefe crea su propia delegacion; SUPERADMIN puede registrarla en nombre de otro jefe.
  async crear(
    actor: UsuarioAutenticado,
    entrada: DatosCrearDelegacion,
  ): Promise<Delegacion> {
    this.exigirPermisoAdministracion(actor);

    const deleganteId =
      actor.rol === 'SUPERADMIN' ? entrada.deleganteId : actor.id;

    if (deleganteId === undefined) {
      throw AppError.reglaDeNegocio(
        'SUPERADMIN debe indicar el jefe responsable de la delegacion',
      );
    }

    if (entrada.delegadoId === deleganteId) {
      throw AppError.reglaDeNegocio(
        'Una persona no puede delegar sus atribuciones en si misma',
      );
    }

    const ahora = this.ahora();

    if (entrada.vigenteDesde.getTime() < ahora.getTime()) {
      throw AppError.reglaDeNegocio(
        'La fecha de inicio de la delegacion no puede estar en el pasado',
      );
    }

    if (entrada.vigenteHasta.getTime() <= entrada.vigenteDesde.getTime()) {
      throw AppError.reglaDeNegocio(
        'La fecha de finalizacion debe ser posterior a la fecha de inicio',
      );
    }

    return this.deps.repositorio.crear(actor.empresaId, actor.id, {
      deleganteId,
      delegadoId: entrada.delegadoId,
      vigenteDesde: entrada.vigenteDesde,
      vigenteHasta: entrada.vigenteHasta,
      motivo: entrada.motivo,
    });
  }

  // El jefe revoca su delegacion; SUPERADMIN puede revocar cualquier delegacion del hospital.
  async revocar(
    actor: UsuarioAutenticado,
    delegacionId: number,
  ): Promise<Delegacion> {
    this.exigirPermisoAdministracion(actor);

    const delegacion = await this.deps.repositorio.obtener(
      actor.empresaId,
      delegacionId,
    );

    if (!delegacion) {
      throw AppError.noEncontrado('La delegacion no existe en este hospital');
    }

    if (actor.rol !== 'SUPERADMIN' && delegacion.delegante.id !== actor.id) {
      throw AppError.prohibido();
    }

    if (delegacion.revocadaAt !== null) {
      throw AppError.reglaDeNegocio('La delegacion ya fue revocada');
    }

    return this.deps.repositorio.revocar(
      actor.empresaId,
      delegacionId,
      actor.id,
      this.ahora(),
    );
  }

  // Centraliza los roles que pueden administrar delegaciones.
  private exigirPermisoAdministracion(actor: UsuarioAutenticado): void {
    if (actor.rol !== 'JEFE_AREA' && actor.rol !== 'SUPERADMIN') {
      throw AppError.prohibido();
    }
  }
}