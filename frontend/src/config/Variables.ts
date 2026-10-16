// Variables globales del frontend, leidas una sola vez desde import.meta.env.
// Ningun otro archivo toca import.meta.env: todo pasa por el objeto Variables.

// Convierte un texto en numero; si falta o no es valido, devuelve el valor por defecto
export function leerNumero(valor: string | undefined, porDefecto: number): number {
  if (valor === undefined) {
    return porDefecto;
  }
  const numero = Number.parseFloat(valor);
  return Number.isNaN(numero) ? porDefecto : numero;
}

const entorno = import.meta.env;

export const Variables = {
  // Nombre de la aplicacion que se muestra en la interfaz
  nombreApp: entorno.VITE_APP_NOMBRE ?? 'Sistema de Vacaciones Hospitalarias',
  // URL base de la API
  apiUrl: entorno.VITE_API_URL ?? '/api',
  // Tiempo en que los datos de React Query se consideran frescos
  cacheTiempoMs: leerNumero(entorno.VITE_CACHE_TIEMPO_MS, 60_000),
} as const;