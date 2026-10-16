// Lector de archivos CSV (texto separado por comas, punto y coma o tabulaciones), escrito a mano:
// maneja comillas, comillas escapadas, saltos de linea de Windows, BOM y la codificacion de Excel en espanol.
import { AppError } from '../../../shared/errors/AppError';
import { armarTabla } from './tabla';
import type { Celda, ILector, TablaCruda } from './tipos';

// UTF-8 estricto; si el archivo no lo es (por ejemplo un CSV de Excel en Windows), se lee como Latin-1
function decodificar(contenido: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    return contenido.toString('latin1');
  }
}

// El separador es el mas frecuente en la primera linea, fuera de comillas. Excel en espanol usa ";"
function detectarSeparador(texto: string): string {
  const primeraLinea = texto.split(/\r?\n/).find((linea) => linea.trim() !== '') ?? '';
  const cuentas: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let entreComillas = false;
  for (const caracter of primeraLinea) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (!entreComillas && caracter in cuentas) {
      cuentas[caracter] = (cuentas[caracter] ?? 0) + 1;
    }
  }
  let mejor = ',';
  for (const separador of [';', '\t']) {
    if ((cuentas[separador] ?? 0) > (cuentas[mejor] ?? 0)) {
      mejor = separador;
    }
  }
  return mejor;
}

function dividirRegistros(texto: string, separador: string): string[][] {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto.charAt(i);
    if (entreComillas) {
      if (caracter === '"') {
        if (texto.charAt(i + 1) === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      registro.push(campo);
      campo = '';
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto.charAt(i + 1) === '\n') {
        i++;
      }
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else {
      campo += caracter;
    }
  }
  if (campo !== '' || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }
  return registros;
}

function leerCsv(contenido: Buffer): TablaCruda {
  const texto = decodificar(contenido).replace(/^\uFEFF/, '');
  if (texto.trim() === '') {
    throw AppError.validacion('El archivo esta vacio');
  }
  const filas: Celda[][] = dividirRegistros(texto, detectarSeparador(texto)).map((registro) =>
    registro.map((valor) => {
      const limpio = valor.trim();
      return limpio === '' ? null : limpio;
    }),
  );
  return armarTabla(filas);
}

export class LectorCsv implements ILector {
  leer(contenido: Buffer): Promise<TablaCruda> {
    try {
      return Promise.resolve(leerCsv(contenido));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}