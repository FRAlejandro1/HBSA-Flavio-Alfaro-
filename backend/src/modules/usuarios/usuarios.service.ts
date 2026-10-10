// Reglas de negocio de usuarios: permisos por rol, coherencia entre correo y cuenta, bajas y reactivaciones.
// Las restricciones de la base (cedula y correo unicos, referencias del mismo hospital) las traduce el repository.
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type { CodigoRol } from '../../shared/types/roles';
import { ROLES_ASIGNABLES } from './usuarios.dominio';
import type { CambiosUsuario, FiltrosUsuarios, PaginaUsuarios, UsuarioDetalle } from './usuarios.dominio';
import type { IUsuariosRepository } from './usuarios.repository';
import type { ActualizarUsuarioEntrada, CrearUsuarioEntrada } from './usuarios.validators';

export interface DependenciasUsuariosService {
  repositorio: IUsuariosRepository;
  // Hash de la clave; detras de una funcion para sustituir Argon2 en las pruebas
  hashear: (clave: string) => Promise<string>;
}

export class UsuariosService {
  constructor(private readonly deps: DependenciasUsuariosService) {}

  async listar(empresaId: number, filtros: FiltrosUsuarios): Promise<PaginaUsuarios> {
    const { usuarios, total } = await this.deps.repositorio.buscar(empresaId, filtros);
    return { usuarios, total, pagina: filtros.pagina, porPagina: filtros.porPagina };
  }

  async obtener(empresaId: number, id: number): Promise<UsuarioDetalle> {
    const usuario = await this.deps.repositorio.obtener(empresaId, id);
    if (!usuario) {
      throw AppError.noEncontrado('La persona no existe');
    }
    return usuario;
  }

  async crear(actor: UsuarioAutenticado, entrada: CrearUsuarioEntrada): Promise<UsuarioDetalle> {
    this.exigirPuedeAsignar(actor.rol, entrada.rol);

    const correo = entrada.correo ?? null;
    if (entrada.clave !== undefined && correo === null) {
      throw AppError.reglaDeNegocio('Para crear una cuenta de acceso se necesita el correo');
    }
    const passwordHash = entrada.clave === undefined ? null : await this.deps.hashear(entrada.clave);

    const id = await this.deps.repositorio.crear(actor.empresaId, {
      cedula: entrada.cedula,
      nombres: entrada.nombres,
      apellidos: entrada.apellidos,
      correo,
      telefono: entrada.telefono ?? null,
      areaId: entrada.areaId,
      cargoId: entrada.cargoId,
      rol: entrada.rol,
      jefeInmediatoId: entrada.jefeInmediatoId,
      fechaIngreso: entrada.fechaIngreso,
      passwordHash,
    });
    return this.obtener(actor.empresaId, id);
  }

  async actualizar(
    actor: UsuarioAutenticado,
    id: number,
    entrada: ActualizarUsuarioEntrada,
  ): Promise<UsuarioDetalle> {
    const existente = await this.obtener(actor.empresaId, id);
    this.exigirPuedeGestionar(actor.rol, existente.rol);
    if (entrada.rol !== undefined) {
      this.exigirPuedeAsignar(actor.rol, entrada.rol);
    }
    if (entrada.jefeInmediatoId === id) {
      throw AppError.reglaDeNegocio('Una persona no puede ser su propio jefe inmediato');
    }

    // Estado final de correo y cuenta: una cuenta de acceso siempre necesita correo
    const correoFinal = entrada.correo !== undefined ? entrada.correo : existente.correo;
    const tendraCuenta = entrada.clave !== undefined ? entrada.clave !== null : existente.tieneCuenta;
    if (tendraCuenta && correoFinal === null) {
      throw AppError.reglaDeNegocio(
        'Una cuenta de acceso necesita correo: quita primero el acceso (clave en null)',
      );
    }

    const { clave, ...resto } = entrada;
    const cambios: CambiosUsuario = { ...resto };
    if (clave !== undefined) {
      cambios.passwordHash = clave === null ? null : await this.deps.hashear(clave);
    }
    // Un cambio de clave, rol o correo obliga a iniciar sesion de nuevo
    if (clave !== undefined || entrada.rol !== undefined || entrada.correo !== undefined) {
      cambios.cerrarSesion = true;
    }

    await this.deps.repositorio.actualizar(actor.empresaId, id, cambios);
    return this.obtener(actor.empresaId, id);
  }

  async darDeBaja(
    actor: UsuarioAutenticado,
    id: number,
    fechaBaja: string | undefined,
  ): Promise<UsuarioDetalle> {
    if (actor.id === id) {
      throw AppError.reglaDeNegocio('No puedes darte de baja a ti mismo');
    }
    const existente = await this.obtener(actor.empresaId, id);
    this.exigirPuedeGestionar(actor.rol, existente.rol);
    if (existente.estado === 'INACTIVO') {
      throw AppError.conflicto('La persona ya esta dada de baja');
    }

    await this.deps.repositorio.darDeBaja(actor.empresaId, id, fechaBaja ?? null);
    return this.obtener(actor.empresaId, id);
  }

  async reactivar(actor: UsuarioAutenticado, id: number): Promise<UsuarioDetalle> {
    const existente = await this.obtener(actor.empresaId, id);
    this.exigirPuedeGestionar(actor.rol, existente.rol);
    if (existente.estado === 'ACTIVO') {
      throw AppError.conflicto('La persona ya esta activa');
    }

    await this.deps.repositorio.reactivar(actor.empresaId, id);
    return this.obtener(actor.empresaId, id);
  }

  // Quien asigna un rol debe poder asignarlo
  private exigirPuedeAsignar(rolActor: CodigoRol, rolNuevo: CodigoRol): void {
    if (!ROLES_ASIGNABLES[rolActor].includes(rolNuevo)) {
      throw AppError.prohibido(`No puedes asignar el rol ${rolNuevo}`);
    }
  }

  // Quien gestiona a una persona debe poder asignar su rol actual
  private exigirPuedeGestionar(rolActor: CodigoRol, rolObjetivo: CodigoRol): void {
    if (!ROLES_ASIGNABLES[rolActor].includes(rolObjetivo)) {
      throw AppError.prohibido(`No puedes gestionar a una persona con el rol ${rolObjetivo}`);
    }
  }
}