// Repositorio de importacion en memoria, para probar sin MySQL: devuelve los catalogos y personas que se le den
// y guarda los planes que se aplican.
import type {
  ItemCatalogo,
  PlanAplicacion,
  UsuarioExistente,
} from '../../src/modules/importacion/importacion.dominio';
import type { IImportacionRepository } from '../../src/modules/importacion/importacion.repository';

export function crearImportacionEnMemoria(datos: {
  areas: ItemCatalogo[];
  cargos: ItemCatalogo[];
  usuarios: UsuarioExistente[];
}): { repositorio: IImportacionRepository; planesAplicados: PlanAplicacion[] } {
  const planesAplicados: PlanAplicacion[] = [];
  const repositorio: IImportacionRepository = {
    listarAreas: () => Promise.resolve(datos.areas),
    listarCargos: () => Promise.resolve(datos.cargos),
    listarUsuarios: () => Promise.resolve(datos.usuarios),
    aplicar: (_empresaId, plan) => {
      planesAplicados.push(plan);
      return Promise.resolve();
    },
  };
  return { repositorio, planesAplicados };
}

// Persona existente con valores razonables; cada prueba cambia lo que necesita
export function usuarioExistente(cambios: Partial<UsuarioExistente> = {}): UsuarioExistente {
  return {
    id: 10,
    cedula: '0102030405',
    nombres: 'Ana',
    apellidos: 'Perez',
    correo: 'ana@hospital.test',
    telefono: null,
    areaId: 1,
    cargoId: 1,
    rol: 'EMPLEADO',
    jefeCedula: null,
    fechaIngreso: '2020-03-01',
    estado: 'ACTIVO',
    fechaBaja: null,
    ...cambios,
  };
}