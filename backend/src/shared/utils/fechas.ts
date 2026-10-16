// Fechas y dias laborables. Las fechas viajan como texto "AAAA-MM-DD" y los calculos se hacen
// en UTC, asi la zona horaria del servidor nunca cambia el resultado.

const MS_POR_DIA = 86_400_000;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Tope de busqueda para no quedar en un ciclo si los datos son absurdos
const LIMITE_BUSQUEDA_DIAS = 4000;

// Dias minimos de anticipacion para que una solicitud sea programada
// (la misma regla la deriva la BD en solicitudes_vacaciones.tipo)
export const DIAS_ANTICIPACION_PROGRAMADA = 7;

// Convierte "AAAA-MM-DD" en Date (UTC); rechaza formatos y fechas inexistentes como 2026-02-31
export function parsearFecha(fecha: string): Date {
  const partes = FORMATO_FECHA.exec(fecha);
  if (!partes) {
    throw new RangeError(`Fecha invalida: ${fecha}`);
  }
  const resultado = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  if (formatearFecha(resultado) !== fecha) {
    throw new RangeError(`Fecha invalida: ${fecha}`);
  }
  return resultado;
}

// Convierte un Date (UTC) en "AAAA-MM-DD"
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Suma (o resta, con negativos) dias calendario a una fecha
export function sumarDias(fecha: string, dias: number): string {
  return formatearFecha(new Date(parsearFecha(fecha).getTime() + dias * MS_POR_DIA));
}

// Dias calendario entre dos fechas (negativo si "hasta" es anterior)
export function diferenciaEnDias(desde: string, hasta: string): number {
  return Math.round((parsearFecha(hasta).getTime() - parsearFecha(desde).getTime()) / MS_POR_DIA);
}

// Sabado o domingo
export function esFinDeSemana(fecha: string): boolean {
  const dia = parsearFecha(fecha).getUTCDay();
  return dia === 0 || dia === 6;
}

// Laborable: ni fin de semana ni feriado
export function esDiaLaborable(fecha: string, feriados: ReadonlySet<string>): boolean {
  return !esFinDeSemana(fecha) && !feriados.has(fecha);
}

// Cuenta los dias laborables entre dos fechas, ambas incluidas
export function calcularDiasLaborables(
  inicio: string,
  fin: string,
  feriados: ReadonlySet<string>,
): number {
  const total = diferenciaEnDias(inicio, fin);
  if (total < 0) {
    throw new RangeError('La fecha final es anterior a la inicial');
  }
  let cuenta = 0;
  for (let i = 0; i <= total; i++) {
    if (esDiaLaborable(sumarDias(inicio, i), feriados)) {
      cuenta++;
    }
  }
  return cuenta;
}

// Fecha del ultimo dia que cubre una cantidad de dias laborables empezando en "inicio".
// Una fraccion de dia (medio dia) ocupa el dia completo.
export function calcularFechaFin(
  inicio: string,
  diasLaborables: number,
  feriados: ReadonlySet<string>,
): string {
  const objetivo = Math.ceil(diasLaborables);
  if (Number.isNaN(objetivo) || objetivo <= 0) {
    throw new RangeError('Los dias laborables deben ser mayores que cero');
  }
  let cuenta = 0;
  for (let i = 0; i < LIMITE_BUSQUEDA_DIAS; i++) {
    const actual = sumarDias(inicio, i);
    if (esDiaLaborable(actual, feriados)) {
      cuenta++;
      if (cuenta === objetivo) {
        return actual;
      }
    }
  }
  throw new RangeError('No se encontro la fecha final dentro del limite de busqueda');
}

// Dias calendario entre la solicitud y el inicio de las vacaciones
export function diasDeAnticipacion(fechaSolicitud: string, fechaInicio: string): number {
  return diferenciaEnDias(fechaSolicitud, fechaInicio);
}

// Programada si se pidio con al menos 7 dias de anticipacion
export function esProgramada(fechaSolicitud: string, fechaInicio: string): boolean {
  return diasDeAnticipacion(fechaSolicitud, fechaInicio) >= DIAS_ANTICIPACION_PROGRAMADA;
}