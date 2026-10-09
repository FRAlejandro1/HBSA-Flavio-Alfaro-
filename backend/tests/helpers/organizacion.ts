// Repositorio de organizacion en memoria, para probar sin MySQL. Reproduce las reglas de la base:
// nombres unicos por hospital y registros en uso que no se pueden eliminar.
import type {
  Area,
  Cargo,
  CambiosArea,
  CambiosCargo,
  DatosArea,
  DatosCargo,
} from '../../src/modules/organizacion/organizacion.dominio';
import type { IOrganizacionRepository } from '../../src/modules/organizacion/organizacion.repository';
import { AppError } from '../../src/shared/errors/AppError';

interface AreaGuardada {
  empresaId: number;
  area: Area;
}

interface CargoGuardado {
  empresaId: number;
  cargo: Cargo;
}

// Rechaza con un error de dominio, como lo haria el repository real al traducir la base
function rechazar(error: AppError): Promise<never> {
  return Promise.reject(error);
}

export function crearOrganizacionEnMemoria(): {
  repositorio: IOrganizacionRepository;
  // Ids que se consideran "en uso": eliminarlos produce un conflicto
  areasEnUso: Set<number>;
  cargosEnUso: Set<number>;
} {
  let siguienteId = 100;
  const areas: AreaGuardada[] = [];
  const cargos: CargoGuardado[] = [];
  const areasEnUso = new Set<number>();
  const cargosEnUso = new Set<number>();

  const repositorio: IOrganizacionRepository = {
    listarAreas: (empresaId) =>
      Promise.resolve(
        areas
          .filter((a) => a.empresaId === empresaId)
          .map((a) => a.area)
          .sort((a, b) => a.detalle.localeCompare(b.detalle)),
      ),

    buscarArea: (empresaId, id) =>
      Promise.resolve(areas.find((a) => a.empresaId === empresaId && a.area.id === id)?.area ?? null),

    crearArea: (empresaId, datos: DatosArea) => {
      if (areas.some((a) => a.empresaId === empresaId && a.area.detalle === datos.detalle)) {
        return rechazar(AppError.conflicto('Ya existe un area con ese nombre'));
      }
      siguienteId += 1;
      const jefe =
        datos.jefeId === null
          ? null
          : { id: datos.jefeId, nombres: 'Jefe', apellidos: 'De prueba' };
      areas.push({ empresaId, area: { id: siguienteId, detalle: datos.detalle, jefe } });
      return Promise.resolve(siguienteId);
    },

    actualizarArea: (empresaId, id, cambios: CambiosArea) => {
      const guardada = areas.find((a) => a.empresaId === empresaId && a.area.id === id);
      if (guardada) {
        if (cambios.detalle !== undefined) {
          guardada.area.detalle = cambios.detalle;
        }
        if (cambios.jefeId !== undefined) {
          guardada.area.jefe =
            cambios.jefeId === null
              ? null
              : { id: cambios.jefeId, nombres: 'Jefe', apellidos: 'De prueba' };
        }
      }
      return Promise.resolve();
    },

    eliminarArea: (empresaId, id) => {
      const indice = areas.findIndex((a) => a.empresaId === empresaId && a.area.id === id);
      if (indice === -1) {
        return Promise.resolve(false);
      }
      if (areasEnUso.has(id)) {
        return rechazar(AppError.conflicto('El area esta en uso'));
      }
      areas.splice(indice, 1);
      return Promise.resolve(true);
    },

    listarCargos: (empresaId) =>
      Promise.resolve(
        cargos
          .filter((c) => c.empresaId === empresaId)
          .map((c) => c.cargo)
          .sort((a, b) => a.detalle.localeCompare(b.detalle)),
      ),

    buscarCargo: (empresaId, id) =>
      Promise.resolve(
        cargos.find((c) => c.empresaId === empresaId && c.cargo.id === id)?.cargo ?? null,
      ),

    crearCargo: (empresaId, datos: DatosCargo) => {
      if (cargos.some((c) => c.empresaId === empresaId && c.cargo.detalle === datos.detalle)) {
        return rechazar(AppError.conflicto('Ya existe un cargo con ese nombre'));
      }
      siguienteId += 1;
      cargos.push({ empresaId, cargo: { id: siguienteId, ...datos } });
      return Promise.resolve(siguienteId);
    },

    actualizarCargo: (empresaId, id, cambios: CambiosCargo) => {
      const guardado = cargos.find((c) => c.empresaId === empresaId && c.cargo.id === id);
      if (guardado) {
        guardado.cargo = { ...guardado.cargo, ...cambios };
      }
      return Promise.resolve();
    },

    eliminarCargo: (empresaId, id) => {
      const indice = cargos.findIndex((c) => c.empresaId === empresaId && c.cargo.id === id);
      if (indice === -1) {
        return Promise.resolve(false);
      }
      if (cargosEnUso.has(id)) {
        return rechazar(AppError.conflicto('El cargo esta en uso'));
      }
      cargos.splice(indice, 1);
      return Promise.resolve(true);
    },
  };

  return { repositorio, areasEnUso, cargosEnUso };
}