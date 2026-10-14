// Pruebas del lector de Excel: se arma un .xlsx en memoria con exceljs y se lee con el lector real.
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { detectarTipo, leerTabla } from '../../../../src/modules/importacion/lectores';
import { LectorXlsx } from '../../../../src/modules/importacion/lectores/LectorXlsx';

async function crearXlsx(filas: (string | number | Date | null)[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Personal');
  for (const fila of filas) {
    hoja.addRow(fila);
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('LectorXlsx', () => {
  it('lee texto, numeros y fechas de la primera hoja', async () => {
    const contenido = await crearXlsx([
      ['Cédula', 'Nombres', 'Fecha de ingreso'],
      [102030405, 'Ana', new Date(Date.UTC(2020, 2, 1))],
    ]);
    const tabla = await new LectorXlsx().leer(contenido);
    expect(tabla.encabezados).toEqual(['Cédula', 'Nombres', 'Fecha de ingreso']);
    expect(tabla.filas[0]?.[0]).toBe(102030405);
    expect(tabla.filas[0]?.[1]).toBe('Ana');
    expect(tabla.filas[0]?.[2]).toBeInstanceOf(Date);
  });

  it('salta las filas vacias', async () => {
    const contenido = await crearXlsx([['A', 'B'], [null, null], ['1', '2']]);
    const tabla = await new LectorXlsx().leer(contenido);
    expect(tabla.filas).toEqual([['1', '2']]);
  });

  it('rechaza un archivo que no es un Excel valido', async () => {
    await expect(new LectorXlsx().leer(Buffer.from('esto no es un xlsx'))).rejects.toMatchObject({
      codigo: 'VALIDACION',
    });
  });
});

describe('detectarTipo y leerTabla', () => {
  it('elige el lector segun la extension y el contenido', async () => {
    const xlsx = await crearXlsx([['A'], ['1']]);
    expect(detectarTipo({ nombre: 'personal.xlsx', contenido: xlsx })).toBe('xlsx');
    expect(detectarTipo({ nombre: 'personal.CSV', contenido: Buffer.from('A\n1\n') })).toBe('csv');
    const { tipo, tabla } = await leerTabla({ nombre: 'personal.csv', contenido: Buffer.from('A\n1\n') });
    expect(tipo).toBe('csv');
    expect(tabla.filas).toEqual([['1']]);
  });

  it('rechaza el .xls antiguo, formatos desconocidos y archivos que mienten', () => {
    expect(() => detectarTipo({ nombre: 'a.xls', contenido: Buffer.from('x') })).toThrow(/\.xlsx/);
    expect(() => detectarTipo({ nombre: 'a.pdf', contenido: Buffer.from('x') })).toThrow(/no admitido/);
    expect(() => detectarTipo({ nombre: 'a.xlsx', contenido: Buffer.from('texto plano') })).toThrow(/contenido/);
    expect(() => detectarTipo({ nombre: 'a.csv', contenido: Buffer.from([65, 0, 66]) })).toThrow(/CSV de texto/);
    expect(() => detectarTipo({ nombre: 'a.csv', contenido: Buffer.alloc(0) })).toThrow(/vacio/);
  });
});