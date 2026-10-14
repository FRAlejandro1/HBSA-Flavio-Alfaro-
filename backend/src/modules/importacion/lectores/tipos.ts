// Tipos y limites comunes de los lectores de archivos de personal (uno por formato).

// Valor de una celda ya leida: el lector de Excel puede devolver fechas y numeros, el de CSV solo texto
export type Celda = string | number | boolean | Date | null;

// Tabla cruda: la primera fila con datos son los encabezados y el resto son las filas
export interface TablaCruda {
  encabezados: string[];
  filas: Celda[][];
}

// Cada formato tiene su propio lector detras de esta interfaz
export interface ILector {
  leer: (contenido: Buffer) => Promise<TablaCruda>;
}

export type TipoArchivo = 'xlsx' | 'csv';

export interface ArchivoSubido {
  nombre: string;
  contenido: Buffer;
}

// Topes para que un archivo enorme o malicioso no agote la memoria del servidor
export const LIMITES_ARCHIVO = {
  bytes: 5 * 1024 * 1024,
  filas: 5000,
  columnas: 40,
} as const;