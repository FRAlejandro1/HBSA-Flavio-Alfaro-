// Calculo de los periodos de vacaciones de una persona: uno por cada anio de servicio, contado desde su fecha de ingreso.
// Es una funcion pura: no toca la base ni el reloj, asi se prueba con fechas fijas.
import { formatearFecha, parsearFecha } from '../../shared/utils/fechas';

// Un periodo caduca a los 2 anios de su inicio: pasado ese plazo la persona pierde los dias que no uso
export const ANIOS_DE_VIGENCIA = 2;

// Anios de servicio que deben pasar para que empiece el primer periodo (0: desde el mismo dia de ingreso)
export const ANIOS_ANTES_DEL_PRIMER_PERIODO = 0;

export interface PeriodoNuevo {
  fechaInicio: string;
  fechaCaducidad: string;
}

// Suma anios a una fecha AAAA-MM-DD; el 29 de febrero pasa al 28 en los anios que no son bisiestos (igual que MySQL)
export function sumarAnios(fecha: string, anios: number): string {
  const base = parsearFecha(fecha);
  const anio = base.getUTCFullYear() + anios;
  const mes = base.getUTCMonth();
  // El dia 0 del mes siguiente es el ultimo dia de este mes
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return formatearFecha(new Date(Date.UTC(anio, mes, Math.min(base.getUTCDate(), ultimoDia))));
}

// Periodos que ya empezaron y todavia no caducan a la fecha indicada: el primero empieza el dia de ingreso
// y cada aniversario abre otro. Una persona que aun no ingresa no tiene ninguno.
export function calcularPeriodosVigentes(fechaIngreso: string, hoy: string): PeriodoNuevo[] {
  const periodos: PeriodoNuevo[] = [];
  for (let anio = ANIOS_ANTES_DEL_PRIMER_PERIODO; ; anio++) {
    const fechaInicio = sumarAnios(fechaIngreso, anio);
    // Las fechas AAAA-MM-DD se comparan bien como texto
    if (fechaInicio > hoy) {
      break;
    }
    const fechaCaducidad = sumarAnios(fechaInicio, ANIOS_DE_VIGENCIA);
    if (fechaCaducidad >= hoy) {
      periodos.push({ fechaInicio, fechaCaducidad });
    }
  }
  return periodos;
}