// Repositorio de periodos en memoria, para probar sin MySQL. Reproduce lo que importa al service:
// los periodos se reconocen por persona y fecha de inicio, las areas forman un arbol y todo es por hospital.
import type { PeriodoNuevo } from '../../src/modules/vacaciones/vacaciones.periodos';
import type {
  DatosDePeriodos,
  DiasDeArea,
  IPeriodosRepository,
} from '../../src/modules/vacaciones/vacaciones.periodos.repository';

export interface PersonaConPeriodos extends DatosDePeriodos {
  empresaId: number;
}

export interface AreaConDias {
  empresaId: number;
  parentId: number | null;
  diasVacaciones: number | null;
}

export interface PeriodoGuardado extends PeriodoNuevo {
  empresaId: number;
  usuarioId: number;
  diasDerecho: number;
}

// Lo que el repository real dejaria en la bitacora
export interface ConstanciaGuardada {
  empresaId: number;
  actorId: number;
  entidad: 'areas' | 'usuarios';
  entidadId: number;
  antes: number | null;
  despues: number | null;
}

export function crearPeriodosEnMemoria() {
  const personas = new Map<number, PersonaConPeriodos>();
  const areas = new Map<number, AreaConDias>();
  const periodos: PeriodoGuardado[] = [];
  const constancias: ConstanciaGuardada[] = [];

  const repositorio: IPeriodosRepository = {
    buscarDatosDePeriodos: (empresaId, usuarioId) => {
      const persona = personas.get(usuarioId);
      if (persona?.empresaId !== empresaId) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        areaId: persona.areaId,
        fechaIngreso: persona.fechaIngreso,
        diasVacaciones: persona.diasVacaciones,
      });
    },

    // Sube desde el area hasta la raiz; vacia si el area no existe en ese hospital
    listarDiasDeCadenaDeAreas: (empresaId, areaId) => {
      const cadena: DiasDeArea[] = [];
      let actual = areas.get(areaId);
      let nivel = 0;
      while (actual?.empresaId === empresaId) {
        cadena.push({ nivel, diasVacaciones: actual.diasVacaciones });
        if (actual.parentId === null) {
          break;
        }
        actual = areas.get(actual.parentId);
        nivel += 1;
      }
      return Promise.resolve(cadena);
    },

    crearPeriodosFaltantes: (empresaId, usuarioId, nuevos, diasDerecho) => {
      for (const nuevo of nuevos) {
        const existe = periodos.some(
          (p) => p.empresaId === empresaId && p.usuarioId === usuarioId && p.fechaInicio === nuevo.fechaInicio,
        );
        if (!existe) {
          periodos.push({ empresaId, usuarioId, ...nuevo, diasDerecho });
        }
      }
      return Promise.resolve();
    },

    fijarDiasDeArea: (empresaId, areaId, dias, actorId) => {
      const area = areas.get(areaId);
      if (area?.empresaId !== empresaId) {
        return Promise.resolve(false);
      }
      constancias.push({ empresaId, actorId, entidad: 'areas', entidadId: areaId, antes: area.diasVacaciones, despues: dias });
      area.diasVacaciones = dias;
      return Promise.resolve(true);
    },

    fijarDiasDePersona: (empresaId, usuarioId, dias, actorId) => {
      const persona = personas.get(usuarioId);
      if (persona?.empresaId !== empresaId) {
        return Promise.resolve(false);
      }
      constancias.push({
        empresaId,
        actorId,
        entidad: 'usuarios',
        entidadId: usuarioId,
        antes: persona.diasVacaciones,
        despues: dias,
      });
      persona.diasVacaciones = dias;
      return Promise.resolve(true);
    },
  };

  return { repositorio, personas, areas, periodos, constancias };
}