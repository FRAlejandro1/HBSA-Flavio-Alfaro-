// Arma la tabla cruda a partir de las filas leidas: busca la fila de encabezados, descarta filas vacias
// y aplica los limites. Lo comparten los dos lectores.
import { AppError } from '../../../shared/errors/AppError';
import { LIMITES_ARCHIVO } from './tipos';
import type { Celda, TablaCruda } from './tipos';

function esVacia(fila: readonly Celda[]): boolean {
  return fila.every((celda) => celda === null);
}

export function armarTabla(filasLeidas: readonly Celda[][]): TablaCruda {
  const [primera, ...resto] = filasLeidas.filter((fila) => !esVacia(fila));
  if (primera === undefined) {
    throw AppError.validacion('El archivo no tiene datos');
  }

  // Las columnas sin encabezado al final se descartan
  let columnas = primera.length;
  while (columnas > 0 && primera[columnas - 1] === null) {
    columnas -= 1;
  }
  if (columnas === 0 || columnas > LIMITES_ARCHIVO.columnas) {
    throw AppError.validacion(`El archivo debe tener entre 1 y ${LIMITES_ARCHIVO.columnas} columnas`);
  }
  if (resto.length > LIMITES_ARCHIVO.filas) {
    throw AppError.validacion(`El archivo supera el maximo de ${LIMITES_ARCHIVO.filas} filas`);
  }

  return {
    encabezados: primera.slice(0, columnas).map((celda) => (celda === null ? '' : String(celda).trim())),
    // Cada fila se recorta o completa al ancho de los encabezados
    filas: resto.map((fila) => Array.from({ length: columnas }, (_, i) => fila[i] ?? null)),
  };
}