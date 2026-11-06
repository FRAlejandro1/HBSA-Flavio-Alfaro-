// Servicio de gestión de jornadas.
// Valida turnos, patrones y asignaciones y calcula la jornada según el ciclo rotativo.

import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import type {
  AsignacionJornada,
  DatosActualizarTurno,
  DatosCerrarAsignacion,
  DatosNuevaAsignacion,
  DatosNuevoPatron,
  DatosNuevoTurno,
  JornadaDeFecha,
  PatronJornada,
  TurnoJornada,
} from './jornadas.dominio';
import type { IJornadasRepository } from './jornadas.repository';

export interface DependenciasJornadasService {
  repositorio: IJornadasRepository;
}

// Comprueba el formato de hora que utiliza MySQL: HH:mm:ss.
function horaValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(hora);
}

// Convierte una hora en minutos desde el inicio del día.
function minutosDesdeMedianoche(hora: string): number {
  const partes = hora.split(':');
  const horas = Number(partes[0]!);
  const minutos = Number(partes[1]!);
  return horas * 60 + minutos;
}

// Calcula la duración del turno, considerando que puede terminar al día siguiente.
function duracionTurno(horaInicio: string, horaFin: string): number {
  const inicio = minutosDesdeMedianoche(horaInicio);
  const fin = minutosDesdeMedianoche(horaFin);
  return (fin - inicio + 1440) % 1440;
}

// Comprueba que una fecha tenga formato YYYY-MM-DD y represente un día real.
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [anio = Number.NaN, mes = Number.NaN, dia = Number.NaN] = fecha.split('-').map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia
  );
}

// Convierte una fecha calendario en un entero de días UTC para evitar cambios por zona horaria.
function numeroDia(fecha: string): number {
  const [anio = Number.NaN, mes = Number.NaN, dia = Number.NaN] = fecha.split('-').map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / 86_400_000);
}

// Normaliza el módulo para obtener posiciones válidas incluso antes de la fecha de referencia.
function moduloPositivo(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor;
}

// Normaliza los datos y comprueba las reglas del turno antes de persistirlo.
function validarDatosTurno<T extends DatosNuevoTurno>(datos: T): T {
  const nombre = datos.nombre.trim();

  if (nombre.length < 2 || nombre.length > 100) {
    throw AppError.validacion('El nombre del turno debe tener entre 2 y 100 caracteres');
  }

  if (!horaValida(datos.horaInicio) || !horaValida(datos.horaFin)) {
    throw AppError.validacion('Las horas del turno deben tener el formato HH:mm:ss');
  }

  const duracion = duracionTurno(datos.horaInicio, datos.horaFin);

  if (duracion === 0) {
    throw AppError.validacion('La hora de inicio y fin del turno no pueden ser iguales');
  }

  if (!Number.isInteger(datos.minutosDescanso) || datos.minutosDescanso < 0) {
    throw AppError.validacion('Los minutos de descanso deben ser un entero igual o mayor que cero');
  }

  if (datos.minutosDescanso >= duracion) {
    throw AppError.validacion('El descanso debe ser menor que la duración del turno');
  }

  return { ...datos, nombre };
}

// Valida la estructura completa del ciclo antes de consultar los turnos asociados.
function validarDatosPatron(datos: DatosNuevoPatron): DatosNuevoPatron {
  const nombre = datos.nombre.trim();

  if (nombre.length < 2 || nombre.length > 100) {
    throw AppError.validacion('El nombre del patrón debe tener entre 2 y 100 caracteres');
  }

  if (
    datos.descripcion !== null &&
    (typeof datos.descripcion !== 'string' || datos.descripcion.length > 500)
  ) {
    throw AppError.validacion('La descripción del patrón no puede superar los 500 caracteres');
  }

  if (!Number.isInteger(datos.cicloDias) || datos.cicloDias < 1 || datos.cicloDias > 366) {
    throw AppError.validacion('El ciclo del patrón debe tener entre 1 y 366 días');
  }

  if (!Array.isArray(datos.dias) || datos.dias.length !== datos.cicloDias) {
    throw AppError.validacion('El patrón debe contener exactamente un registro por cada día del ciclo');
  }

  const posiciones = new Set<number>();

  for (const dia of datos.dias) {
    if (
      !Number.isInteger(dia.diaCiclo) ||
      dia.diaCiclo < 1 ||
      dia.diaCiclo > datos.cicloDias
    ) {
      throw AppError.validacion('Cada día del patrón debe estar dentro del ciclo configurado');
    }

    if (posiciones.has(dia.diaCiclo)) {
      throw AppError.validacion('El patrón no puede contener posiciones de ciclo duplicadas');
    }

    posiciones.add(dia.diaCiclo);

    if (dia.tipoDia === 'TURNO') {
      if (dia.turnoId === null || !Number.isInteger(dia.turnoId) || dia.turnoId < 1) {
        throw AppError.validacion('Cada día de tipo TURNO debe tener un turno válido');
      }
    } else if (dia.tipoDia === 'DESCANSO') {
      if (dia.turnoId !== null) {
        throw AppError.validacion('Los días de tipo DESCANSO no pueden tener un turno asociado');
      }
    } else {
      throw AppError.validacion('El tipo de día del patrón no es válido');
    }
  }

  return {
    ...datos,
    nombre,
    dias: [...datos.dias].sort((a, b) => a.diaCiclo - b.diaCiclo),
  };
}

export class JornadasService {
  constructor(private readonly deps: DependenciasJornadasService) {}

  // Obtiene un turno perteneciente al hospital del usuario autenticado.
  async obtenerTurno(actor: UsuarioAutenticado, turnoId: number): Promise<TurnoJornada> {
    const turno = await this.deps.repositorio.obtenerTurno(actor.empresaId, turnoId);

    if (turno === null) {
      throw AppError.noEncontrado('El turno no existe');
    }

    return turno;
  }

  // Lista los turnos del hospital; por defecto excluye los inactivos.
  async listarTurnos(
    actor: UsuarioAutenticado,
    incluirInactivos = false,
  ): Promise<TurnoJornada[]> {
    return this.deps.repositorio.listarTurnos(actor.empresaId, incluirInactivos);
  }

  // Valida y registra un turno en el hospital del usuario autenticado.
  async crearTurno(
    actor: UsuarioAutenticado,
    datos: DatosNuevoTurno,
  ): Promise<TurnoJornada> {
    const datosValidados = validarDatosTurno(datos);

    return this.deps.repositorio.crearTurno(
      actor.empresaId,
      actor.id,
      datosValidados,
    );
  }

  // Comprueba la existencia del turno, valida los cambios y actualiza su configuración.
  async actualizarTurno(
    actor: UsuarioAutenticado,
    turnoId: number,
    datos: DatosActualizarTurno,
  ): Promise<TurnoJornada> {
    await this.obtenerTurno(actor, turnoId);

    if (typeof datos.activo !== 'boolean') {
      throw AppError.validacion('El estado activo del turno debe ser booleano');
    }

    const datosValidados = validarDatosTurno(datos);

    return this.deps.repositorio.actualizarTurno(
      actor.empresaId,
      actor.id,
      turnoId,
      datosValidados,
    );
  }

  // Obtiene un patrón del hospital autenticado y sus posiciones del ciclo.
  async obtenerPatron(actor: UsuarioAutenticado, patronId: number): Promise<PatronJornada> {
    const patron = await this.deps.repositorio.obtenerPatron(actor.empresaId, patronId);

    if (patron === null) {
      throw AppError.noEncontrado('El patrón de jornada no existe');
    }

    return patron;
  }

  // Lista los patrones del hospital; por defecto excluye los inactivos.
  async listarPatrones(
    actor: UsuarioAutenticado,
    incluirInactivos = false,
  ): Promise<PatronJornada[]> {
    return this.deps.repositorio.listarPatrones(actor.empresaId, incluirInactivos);
  }

  // Valida el ciclo y comprueba que todos sus turnos pertenezcan al hospital y estén activos.
  async crearPatron(
    actor: UsuarioAutenticado,
    datos: DatosNuevoPatron,
  ): Promise<PatronJornada> {
    const datosValidados = validarDatosPatron(datos);
    const turnosUnicos = new Set(
      datosValidados.dias
        .filter((dia) => dia.tipoDia === 'TURNO')
        .map((dia) => dia.turnoId as number),
    );

    for (const turnoId of turnosUnicos) {
      const turno = await this.deps.repositorio.obtenerTurno(actor.empresaId, turnoId);

      if (turno === null) {
        throw AppError.validacion(`El turno ${turnoId} no existe en este hospital`);
      }

      if (!turno.activo) {
        throw AppError.validacion(`El turno ${turnoId} está inactivo y no puede asignarse a un patrón`);
      }
    }

    return this.deps.repositorio.crearPatron(
      actor.empresaId,
      actor.id,
      datosValidados,
    );
  }

  // Valida y asigna un patrón activo a un empleado del mismo hospital.
  async crearAsignacion(
    actor: UsuarioAutenticado,
    datos: DatosNuevaAsignacion,
  ): Promise<AsignacionJornada> {
    if (!Number.isInteger(datos.usuarioId) || datos.usuarioId < 1) {
      throw AppError.validacion('El empleado indicado no es válido');
    }

    if (!Number.isInteger(datos.patronId) || datos.patronId < 1) {
      throw AppError.validacion('El patrón indicado no es válido');
    }

    if (!fechaValida(datos.fechaInicio) || !fechaValida(datos.fechaReferencia)) {
      throw AppError.validacion('Las fechas de asignación deben tener el formato YYYY-MM-DD y ser válidas');
    }

    const patron = await this.obtenerPatron(actor, datos.patronId);

    if (!patron.activo) {
      throw AppError.reglaDeNegocio('No se puede asignar un patrón inactivo');
    }

    return this.deps.repositorio.crearAsignacion(
      actor.empresaId,
      actor.id,
      datos,
    );
  }

  // Cierra una asignación conservando su registro y su trazabilidad histórica.
  async cerrarAsignacion(
    actor: UsuarioAutenticado,
    datos: DatosCerrarAsignacion,
  ): Promise<AsignacionJornada> {
    if (!Number.isInteger(datos.asignacionId) || datos.asignacionId < 1) {
      throw AppError.validacion('La asignación indicada no es válida');
    }

    if (!fechaValida(datos.fechaFin)) {
      throw AppError.validacion('La fecha de cierre debe ser una fecha válida con formato YYYY-MM-DD');
    }

    return this.deps.repositorio.cerrarAsignacion(
      actor.empresaId,
      actor.id,
      datos,
    );
  }

  // Calcula la posición del ciclo y recupera el turno correspondiente a una fecha.
  async obtenerJornadaParaFecha(
    actor: UsuarioAutenticado,
    usuarioId: number,
    fecha: string,
  ): Promise<JornadaDeFecha> {
    if (!Number.isInteger(usuarioId) || usuarioId < 1) {
      throw AppError.validacion('El empleado indicado no es válido');
    }

    if (!fechaValida(fecha)) {
      throw AppError.validacion('La fecha consultada debe ser una fecha válida con formato YYYY-MM-DD');
    }

    const asignacion = await this.deps.repositorio.obtenerAsignacionParaFecha(
      actor.empresaId,
      usuarioId,
      fecha,
    );

    if (asignacion === null) {
      throw AppError.noEncontrado('El empleado no tiene una jornada asignada para la fecha consultada');
    }

    const patron = await this.obtenerPatron(actor, asignacion.patronId);
    const desplazamiento = numeroDia(fecha) - numeroDia(asignacion.fechaReferencia);
    const posicionCiclo = moduloPositivo(desplazamiento, patron.cicloDias) + 1;
    const diaPatron = patron.dias.find((dia) => dia.diaCiclo === posicionCiclo);

    if (diaPatron === undefined) {
      throw AppError.reglaDeNegocio('El patrón no contiene la posición calculada para la fecha consultada');
    }

    if (diaPatron.tipoDia === 'DESCANSO') {
      return {
        fecha,
        esDescanso: true,
        turno: null,
        minutosLaborables: 0,
      };
    }

    if (diaPatron.turnoId === null) {
      throw AppError.reglaDeNegocio('La posición del patrón requiere un turno asociado');
    }

    const turno = await this.deps.repositorio.obtenerTurno(
      actor.empresaId,
      diaPatron.turnoId,
    );

    if (turno === null) {
      throw AppError.reglaDeNegocio('El turno configurado en el patrón ya no existe');
    }

    return {
      fecha,
      esDescanso: false,
      turno,
      minutosLaborables:
        duracionTurno(turno.horaInicio, turno.horaFin) - turno.minutosDescanso,
    };
  }
}
