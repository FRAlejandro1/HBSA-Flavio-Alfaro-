// Tipos del dominio de jornadas: turnos, patrones rotativos y asignaciones historicas.
// No dependen de Express ni de MySQL.

// Un dia del ciclo contiene un turno programado o un descanso.
export type TipoDiaPatron = 'TURNO' | 'DESCANSO';

// Turno definido por un hospital. La hora de fin puede corresponder al dia siguiente.
export interface TurnoJornada {
  id: number;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  minutosDescanso: number;
  activo: boolean;
}

// Configuracion de una posicion concreta dentro del ciclo rotativo.
export interface DiaPatronJornada {
  id: number;
  diaCiclo: number;
  tipoDia: TipoDiaPatron;
  turnoId: number | null;
}

// Patron completo con sus dias ordenados desde el inicio del ciclo.
export interface PatronJornada {
  id: number;
  nombre: string;
  descripcion: string | null;
  cicloDias: number;
  activo: boolean;
  dias: DiaPatronJornada[];
}

// Asignacion historica de un patron a una persona.
// La fecha de referencia identifica la primera posicion del ciclo.
export interface AsignacionJornada {
  id: number;
  usuarioId: number;
  patronId: number;
  fechaInicio: string;
  fechaFin: string | null;
  fechaReferencia: string;
  configuradoPorId: number;
}

// Datos para registrar un turno nuevo.
export interface DatosNuevoTurno {
  nombre: string;
  horaInicio: string;
  horaFin: string;
  minutosDescanso: number;
}

// Datos para modificar la configuracion de un turno existente.
export interface DatosActualizarTurno extends DatosNuevoTurno {
  activo: boolean;
}

// Datos de una posicion del ciclo al crear o actualizar un patron.
export interface DiaPatronNuevo {
  diaCiclo: number;
  tipoDia: TipoDiaPatron;
  turnoId: number | null;
}

// Datos para registrar un patron con todos los dias de su ciclo.
export interface DatosNuevoPatron {
  nombre: string;
  descripcion: string | null;
  cicloDias: number;
  dias: DiaPatronNuevo[];
}

// Datos para modificar un patron existente.
export interface DatosActualizarPatron extends DatosNuevoPatron {
  activo: boolean;
}

// Datos para asignar un patron a una persona.
// La empresa y el usuario que configura se obtienen del contexto autenticado.
export interface DatosNuevaAsignacion {
  usuarioId: number;
  patronId: number;
  fechaInicio: string;
  fechaReferencia: string;
}

// Datos para cerrar la vigencia de una asignacion sin borrar su historial.
export interface DatosCerrarAsignacion {
  asignacionId: number;
  fechaFin: string;
}

// Resultado del turno que corresponde a una fecha concreta.
export interface JornadaDeFecha {
  fecha: string;
  esDescanso: boolean;
  turno: TurnoJornada | null;
  minutosLaborables: number;
}