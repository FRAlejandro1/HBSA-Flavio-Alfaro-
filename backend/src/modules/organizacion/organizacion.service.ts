// Reglas de negocio de areas y cargos: existencia dentro del hospital y respuestas completas.
// Las restricciones de la base (nombres unicos, registros en uso) las traduce el repository.
import { AppError } from '../../shared/errors/AppError';
import type {
  Area,
  CambiosArea,
  CambiosCargo,
  Cargo,
  DatosArea,
  DatosCargo,
} from './organizacion.dominio';
import type { IOrganizacionRepository } from './organizacion.repository';

export class OrganizacionService {
  constructor(private readonly repositorio: IOrganizacionRepository) {}

  listarAreas(empresaId: number): Promise<Area[]> {
    return this.repositorio.listarAreas(empresaId);
  }

  async crearArea(empresaId: number, datos: DatosArea): Promise<Area> {
    const id = await this.repositorio.crearArea(empresaId, datos);
    return this.obtenerArea(empresaId, id);
  }

  async actualizarArea(empresaId: number, id: number, cambios: CambiosArea): Promise<Area> {
    // Primero se comprueba que el area sea de este hospital
    await this.obtenerArea(empresaId, id);
    await this.repositorio.actualizarArea(empresaId, id, cambios);
    return this.obtenerArea(empresaId, id);
  }

  async eliminarArea(empresaId: number, id: number): Promise<void> {
    if (!(await this.repositorio.eliminarArea(empresaId, id))) {
      throw AppError.noEncontrado('El area no existe');
    }
  }

  listarCargos(empresaId: number): Promise<Cargo[]> {
    return this.repositorio.listarCargos(empresaId);
  }

  async crearCargo(empresaId: number, datos: DatosCargo): Promise<Cargo> {
    const id = await this.repositorio.crearCargo(empresaId, datos);
    return this.obtenerCargo(empresaId, id);
  }

  async actualizarCargo(empresaId: number, id: number, cambios: CambiosCargo): Promise<Cargo> {
    await this.obtenerCargo(empresaId, id);
    await this.repositorio.actualizarCargo(empresaId, id, cambios);
    return this.obtenerCargo(empresaId, id);
  }

  async eliminarCargo(empresaId: number, id: number): Promise<void> {
    if (!(await this.repositorio.eliminarCargo(empresaId, id))) {
      throw AppError.noEncontrado('El cargo no existe');
    }
  }

  private async obtenerArea(empresaId: number, id: number): Promise<Area> {
    const area = await this.repositorio.buscarArea(empresaId, id);
    if (!area) {
      throw AppError.noEncontrado('El area no existe');
    }
    return area;
  }

  private async obtenerCargo(empresaId: number, id: number): Promise<Cargo> {
    const cargo = await this.repositorio.buscarCargo(empresaId, id);
    if (!cargo) {
      throw AppError.noEncontrado('El cargo no existe');
    }
    return cargo;
  }
}