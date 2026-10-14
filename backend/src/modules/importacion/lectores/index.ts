// Elige el lector segun el archivo: valida la extension y el contenido real (no confia en el tipo que declare
// el navegador) y devuelve la tabla cruda lista para analizar.
import path from 'node:path';
import { AppError } from '../../../shared/errors/AppError';
import { LectorCsv } from './LectorCsv';
import { LectorXlsx } from './LectorXlsx';
import { LIMITES_ARCHIVO } from './tipos';
import type { ArchivoSubido, ILector, TablaCruda, TipoArchivo } from './tipos';

const LECTORES: Record<TipoArchivo, ILector> = {
  xlsx: new LectorXlsx(),
  csv: new LectorCsv(),
};

// Los .xlsx son archivos zip y empiezan con "PK"
function pareceZip(contenido: Buffer): boolean {
  return contenido.length > 4 && contenido[0] === 0x50 && contenido[1] === 0x4b;
}

export function detectarTipo(archivo: ArchivoSubido): TipoArchivo {
  const extension = path.extname(archivo.nombre).toLowerCase();
  if (archivo.contenido.length === 0) {
    throw AppError.validacion('El archivo esta vacio');
  }
  if (archivo.contenido.length > LIMITES_ARCHIVO.bytes) {
    throw AppError.validacion('El archivo supera los 5 MB');
  }
  if (extension === '.xls') {
    throw AppError.validacion('El formato .xls antiguo no se admite: guarda el archivo como .xlsx o .csv');
  }
  if (extension === '.xlsx') {
    if (!pareceZip(archivo.contenido)) {
      throw AppError.validacion('El archivo dice ser .xlsx pero su contenido no lo es');
    }
    return 'xlsx';
  }
  if (extension === '.csv' || extension === '.txt') {
    // Un archivo de texto no contiene bytes nulos
    if (archivo.contenido.subarray(0, 1024).includes(0)) {
      throw AppError.validacion('El archivo no es un CSV de texto');
    }
    return 'csv';
  }
  throw AppError.validacion('Formato no admitido: usa un archivo .xlsx o .csv');
}

export async function leerTabla(archivo: ArchivoSubido): Promise<{ tipo: TipoArchivo; tabla: TablaCruda }> {
  const tipo = detectarTipo(archivo);
  return { tipo, tabla: await LECTORES[tipo].leer(archivo.contenido) };
}