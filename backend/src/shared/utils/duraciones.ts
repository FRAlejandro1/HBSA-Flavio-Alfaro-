// Convierte duraciones como "15m" o "7d" (las de JWT_ACCESS_TTL y JWT_REFRESH_TTL) en segundos.

const SEGUNDOS_POR_UNIDAD: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

export function duracionASegundos(texto: string): number {
  const partes = /^(\d+)([smhd])$/.exec(texto.trim());
  const cantidad = partes?.[1];
  const unidad = partes?.[2];
  const factor = unidad === undefined ? undefined : SEGUNDOS_POR_UNIDAD[unidad];

  if (cantidad === undefined || factor === undefined) {
    throw new RangeError(`Duracion invalida: "${texto}" (use por ejemplo 30s, 15m, 2h o 7d)`);
  }

  const segundos = Number.parseFloat(cantidad) * factor;
  if (segundos <= 0) {
    throw new RangeError(`La duracion debe ser mayor que cero: "${texto}"`);
  }
  return segundos;
}