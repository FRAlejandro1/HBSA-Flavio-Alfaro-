const FORMATO_FECHA = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Formatea una fecha sin hora para su presentación.
 */
export function fechaLegible(valor: string): string {
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);

  return Number.isNaN(fecha.getTime())
    ? valor
    : FORMATO_FECHA.format(fecha);
}

/**
 * Formatea una fecha y hora, contemplando valores nulos o inválidos.
 */
export function fechaHoraLegible(fecha: string | null): string {
  if (!fecha) {
    return 'Sin registro';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return FORMATO_FECHA_HORA.format(valor);
}

/**
 * Obtiene el nombre completo de una persona.
 */
export function obtenerNombreCompleto(
  nombres: string,
  apellidos: string,
): string {
  return `${nombres} ${apellidos}`.trim();
}