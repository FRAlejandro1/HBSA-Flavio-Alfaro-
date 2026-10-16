// Fechas de calendario en la zona horaria del negocio. El servidor y la base trabajan en UTC;
// cuando una regla se cuenta por dias de calendario (la solicitud es programada si faltan 7 dias o mas),
// el "dia" es el de la zona del hospital, no el de UTC.

// Ecuador continental (UTC-5, sin horario de verano)
export const ZONA_HORARIA_POR_DEFECTO = 'America/Guayaquil';

// Comprueba que el nombre exista en la base de zonas horarias (por ejemplo America/Guayaquil)
export function esZonaHorariaValida(zona: string): boolean {
  try {
    return Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date(0)) !== '';
  } catch {
    return false;
  }
}

// Fecha de calendario (AAAA-MM-DD) que corresponde a un instante en una zona
export function fechaEnZona(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

// Fecha de hoy en la zona del negocio
export function hoyEnZona(zona = ZONA_HORARIA_POR_DEFECTO, ahora: Date = new Date()): string {
  return fechaEnZona(ahora, zona);
}