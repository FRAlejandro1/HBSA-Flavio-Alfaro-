// Repositorio de periodos en memoria para probar sin MySQL.
// Simula la búsqueda de personas por hospital y la creación idempotente de periodos.
import type { PeriodoNuevo } from '../../src/modules/vacaciones/vacaciones.periodos';
import type {
  DatosDePeriodos,
  IPeriodosRepository,
} from '../../src/modules/vacaciones/vacaciones.periodos.repository';

export interface PersonaConPeriodos extends DatosDePeriodos {
  empresaId: number;
}

export interface PeriodoGuardado extends PeriodoNuevo {
  empresaId: number;
  usuarioId: number;
  diasDerecho: number;
}

export function crearPeriodosEnMemoria() {
  const personas = new Map<number, PersonaConPeriodos>();
  const periodos: PeriodoGuardado[] = [];

  const repositorio: IPeriodosRepository = {
    buscarDatosDePeriodos: (empresaId, usuarioId) => {
      const persona = personas.get(usuarioId);

      if (persona?.empresaId !== empresaId) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        fechaIngreso: persona.fechaIngreso,
        diasVacacionesPersona: persona.diasVacacionesPersona,
        diasVacacionesArea: persona.diasVacacionesArea,
      });
    },

    filtrarPeriodosFaltantes: (empresaId, usuarioId, nuevos) => {
      const faltantes = nuevos.filter(
        (nuevo) =>
          !periodos.some(
            (periodo) =>
              periodo.empresaId === empresaId &&
              periodo.usuarioId === usuarioId &&
              periodo.fechaInicio === nuevo.fechaInicio,
          ),
      );

      return Promise.resolve(faltantes);
    },

    crearPeriodosFaltantes: (empresaId, usuarioId, nuevos, diasDerecho) => {
      for (const nuevo of nuevos) {
        const existe = periodos.some(
          (periodo) =>
            periodo.empresaId === empresaId &&
            periodo.usuarioId === usuarioId &&
            periodo.fechaInicio === nuevo.fechaInicio,
        );

        if (!existe) {
          periodos.push({
            empresaId,
            usuarioId,
            ...nuevo,
            diasDerecho,
          });
        }
      }

      return Promise.resolve();
    },
  };

  return { repositorio, personas, periodos };
}