// Lector de archivos de Excel (.xlsx) con exceljs. Lee solo la primera hoja y convierte cada celda a un
// valor simple: texto, numero, fecha o nada (formulas, texto con formato y enlaces se reducen a su valor).
import ExcelJS from 'exceljs';
import { AppError } from '../../../shared/errors/AppError';
import { armarTabla } from './tabla';
import { LIMITES_ARCHIVO } from './tipos';
import type { Celda, ILector, TablaCruda } from './tipos';

function convertirCelda(valor: ExcelJS.CellValue): Celda {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (valor instanceof Date) {
    return valor;
  }
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }
  if ('richText' in valor) {
    const texto = valor.richText.map((parte) => parte.text).join('').trim();
    return texto === '' ? null : texto;
  }
  if ('result' in valor) {
    return convertirCelda(valor.result);
  }
  if ('text' in valor) {
    return convertirCelda(valor.text);
  }
  // Valores de error de Excel (#N/A, #REF!...)
  return null;
}

export class LectorXlsx implements ILector {
  async leer(contenido: Buffer): Promise<TablaCruda> {
    const libro = new ExcelJS.Workbook();
    try {
      // exceljs declara su propio tipo Buffer, que no coincide con el de Node
      await libro.xlsx.load(contenido as unknown as Parameters<typeof libro.xlsx.load>[0]);
    } catch {
      throw AppError.validacion('No se pudo leer el archivo de Excel: esta danado o no es un .xlsx valido');
    }

    const hoja = libro.worksheets[0];
    if (hoja === undefined) {
      throw AppError.validacion('El archivo de Excel no tiene hojas');
    }
    if (hoja.rowCount > LIMITES_ARCHIVO.filas + 100) {
      throw AppError.validacion(`El archivo supera el maximo de ${LIMITES_ARCHIVO.filas} filas`);
    }

    const columnas = Math.min(hoja.columnCount, LIMITES_ARCHIVO.columnas + 1);
    const filas: Celda[][] = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: Celda[] = [];
      for (let columna = 1; columna <= columnas; columna++) {
        celdas.push(convertirCelda(fila.getCell(columna).value));
      }
      filas.push(celdas);
    });
    return armarTabla(filas);
  }
}