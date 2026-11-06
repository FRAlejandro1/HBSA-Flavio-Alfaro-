// Días de anticipación desde los que una solicitud es programada (misma regla del servidor).
export const DIAS_ANTICIPACION_PROGRAMADA = 7;

// Fecha de calendario local en formato AAAA-MM-DD, sin pasar por UTC.
export function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// true si faltan menos de siete días desde hoy hasta el inicio: la justificación es obligatoria.
export function esNoProgramada(hoy: string, inicio: string): boolean {
  const desde = new Date(`${hoy}T12:00:00`);
  const hasta = new Date(`${inicio}T12:00:00`);

  return (
    (hasta.getTime() - desde.getTime()) / 86400000 <
    DIAS_ANTICIPACION_PROGRAMADA
  );
}