const FORMATO_FECHA = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function fechaLegible(valor: string): string {
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);

  return Number.isNaN(fecha.getTime())
    ? valor
    : FORMATO_FECHA.format(fecha);
}

export function obtenerNombreCompleto(
  nombres: string,
  apellidos: string,
): string {
  return `${nombres} ${apellidos}`.trim();
}
