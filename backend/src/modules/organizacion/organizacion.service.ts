// Reglas de negocio de areas y cargos: existencia dentro del hospital, proceso y arbol de areas, respuestas completas.
// Las restricciones de la base (nombres unicos, registros en uso) las traduce el repository.
import { AppError } from '../../shared/errors/AppError';
import type {
  Area,
  CambiosArea,
  CambiosCargo,
  Cargo,
  DatosArea,
  DatosCargo,
  NodoArea,
  Proceso,
} from './organizacion.dominio';
import type { IOrganizacionRepository } from './organizacion.repository';

export class OrganizacionService {
  constructor(private readonly repositorio: IOrganizacionRepository) {}

  listarProcesos(): Promise<Proceso[]> {
    return this.repositorio.listarProcesos();
  }

  listarAreas(empresaId: number): Promise<Area[]> {
    return this.repositorio.listarAreas(empresaId);
  }

  // Areas anidadas: las principales arriba y sus subareas en hijos, cada nivel en orden alfabetico
  async listarArbol(empresaId: number): Promise<NodoArea[]> {
    const areas = await this.repositorio.listarAreas(empresaId);
    const nodos = new Map<number, NodoArea>(areas.map((a) => [a.id, { ...a, hijos: [] }]));
    const raices: NodoArea[] = [];
    for (const nodo of nodos.values()) {
      const padre = nodo.parentId === null ? undefined : nodos.get(nodo.parentId);
      (padre ? padre.hijos : raices).push(nodo);
    }
    return raices;
  }

  async crearArea(empresaId: number, datos: DatosArea): Promise<Area> {
    const procesoId = await this.resolverProceso(empresaId, datos);
    const id = await this.repositorio.crearArea(empresaId, { ...datos, procesoId });
    return this.obtenerArea(empresaId, id);
  }

  async actualizarArea(empresaId: number, id: number, cambios: CambiosArea): Promise<Area> {
    // Primero se comprueba que el area sea de este hospital
    const actual = await this.obtenerArea(empresaId, id);
    if (cambios.parentId !== undefined && cambios.parentId !== null) {
      await this.exigirPadreValido(empresaId, actual, cambios.parentId);
    }
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

  // Proceso de un area nueva: la subarea hereda el de su padre y el area principal debe indicar uno que exista
  private async resolverProceso(empresaId: number, datos: DatosArea): Promise<number | null> {
    if (datos.parentId !== null) {
      const padre = await this.repositorio.buscarArea(empresaId, datos.parentId);
      if (!padre) {
        throw AppError.reglaDeNegocio('El area padre no existe en este hospital');
      }
      if (datos.procesoId !== null && datos.procesoId !== padre.procesoId) {
        throw AppError.reglaDeNegocio('Una subarea pertenece al mismo proceso que su area padre');
      }
      return padre.procesoId;
    }

    if (datos.procesoId === null) {
      throw AppError.reglaDeNegocio('Un area principal necesita el proceso al que pertenece');
    }
    const procesos = await this.repositorio.listarProcesos();
    if (!procesos.some((p) => p.id === datos.procesoId)) {
      throw AppError.reglaDeNegocio('El proceso indicado no existe');
    }
    return datos.procesoId;
  }

  // El nuevo padre debe ser del hospital, del mismo proceso y no puede ser el area ni una de sus descendientes
  private async exigirPadreValido(empresaId: number, area: Area, parentId: number): Promise<void> {
    const areas = await this.repositorio.listarAreas(empresaId);
    const porId = new Map<number, Area>(areas.map((a) => [a.id, a]));

    const padre = porId.get(parentId);
    if (!padre) {
      throw AppError.reglaDeNegocio('El area padre no existe en este hospital');
    }
    if (padre.procesoId !== area.procesoId) {
      throw AppError.reglaDeNegocio('No se puede mover un area a otro proceso');
    }

    // Se sube desde el nuevo padre: si en el camino aparece el area, el movimiento formaria un ciclo
    let cursor: Area | undefined = padre;
    for (let pasos = 0; cursor !== undefined && pasos <= areas.length; pasos += 1) {
      if (cursor.id === area.id) {
        throw AppError.reglaDeNegocio('Un area no puede quedar dentro de si misma ni de sus subareas');
      }
      cursor = cursor.parentId === null ? undefined : porId.get(cursor.parentId);
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