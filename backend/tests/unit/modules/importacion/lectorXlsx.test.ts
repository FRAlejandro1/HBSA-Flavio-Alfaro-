// Pruebas del lector de Excel: se arma un .xlsx en memoria con exceljs y se lee con el lector real.
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { detectarTipo, leerTabla } from '../../../../src/modules/importacion/lectores';
import { LectorXlsx } from '../../../../src/modules/importacion/lectores/LectorXlsx';
import { LIMITES_ARCHIVO } from '../../../../src/modules/importacion/lectores/tipos';

async function crearXlsx(filas: (string | number | Date | null)[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Personal');
  for (const fila of filas) {
    hoja.addRow(fila);
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

async function crearXlsxPersonalizado(
  configurar: (libro: ExcelJS.Workbook, hoja: ExcelJS.Worksheet) => void,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Personal');
  configurar(libro, hoja);
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

  it('rechaza una hoja sin datos', async () => {
    const contenido = await crearXlsxPersonalizado(() => undefined);

    await expect(new LectorXlsx().leer(contenido)).rejects.toMatchObject({
      codigo: 'VALIDACION',
      message: 'El archivo no tiene datos',
    });
  });

  it('rechaza un libro Excel sin hojas', async () => {
    const libro = new ExcelJS.Workbook();
    const contenido = Buffer.from(await libro.xlsx.writeBuffer());

    await expect(new LectorXlsx().leer(contenido)).rejects.toMatchObject({
      codigo: 'VALIDACION',
      message: 'El archivo de Excel no tiene hojas',
    });
  });

  it('rechaza una hoja que supera el limite fisico de filas', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Encabezado']);

      for (let i = 0; i < LIMITES_ARCHIVO.filas - 1; i++) {
        hoja.addRow([`Dato ${i + 1}`]);
      }

      hoja.getRow(LIMITES_ARCHIVO.filas + 101).getCell(1).value = 'Ultima fila';
    });

    await expect(new LectorXlsx().leer(contenido)).rejects.toMatchObject({
      codigo: 'VALIDACION',
    });
  });

  it('rechaza una tabla que supera el maximo de filas de datos', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Encabezado']);

      for (let i = 0; i <= LIMITES_ARCHIVO.filas; i++) {
        hoja.addRow([`Dato ${i}`]);
      }
    });

    await expect(new LectorXlsx().leer(contenido)).rejects.toMatchObject({
      codigo: 'VALIDACION',
      message: `El archivo supera el maximo de ${LIMITES_ARCHIVO.filas} filas`,
    });
  });

  it('rechaza una tabla que supera el maximo de columnas', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      const encabezados = Array.from(
        { length: LIMITES_ARCHIVO.columnas + 1 },
        (_, i) => `Columna ${i + 1}`,
      );
      hoja.addRow(encabezados);
    });

    await expect(new LectorXlsx().leer(contenido)).rejects.toMatchObject({
      codigo: 'VALIDACION',
    });
  });

  it('limita las columnas leidas aunque la hoja tenga mas columnas', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      const fila = hoja.addRow(
        Array.from({ length: LIMITES_ARCHIVO.columnas }, (_, i) => `Columna ${i + 1}`),
      );

      fila.getCell(LIMITES_ARCHIVO.columnas + 2).value = 'Fuera del limite';
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.encabezados).toHaveLength(LIMITES_ARCHIVO.columnas);
    expect(tabla.encabezados[0]).toBe('Columna 1');
    expect(tabla.encabezados.at(-1)).toBe(`Columna ${LIMITES_ARCHIVO.columnas}`);
  });

  it('convierte cadenas, booleanos y valores vacios', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Texto', 'Vacio', 'Booleano', 'Nulo']);
      hoja.addRow(['  contenido  ', '   ', true, null]);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.filas[0]).toEqual(['contenido', null, true, null]);
  });

  it('convierte texto enriquecido y descarta texto enriquecido vacio', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Texto enriquecido', 'Texto vacio']);
      hoja.addRow([
        { richText: [{ text: ' Hola' }, { text: ' mundo ' }] },
        { richText: [{ text: '   ' }, { text: '' }] },
      ]);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.filas[0]).toEqual(['Hola mundo', null]);
  });

  it('extrae el resultado de las formulas', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Formula numerica', 'Formula de texto']);
      hoja.addRow([
        { formula: '1+1', result: 2 },
        { formula: '" resultado "', result: ' resultado ' },
      ]);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.filas[0]).toEqual([2, 'resultado']);
  });

  it('extrae el texto de los hipervinculos', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Enlace']);
      hoja.addRow([{ text: ' Sitio web ', hyperlink: 'https://example.com' }]);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.filas[0]).toEqual(['Sitio web']);
  });

  it('convierte los valores de error de Excel en nulos', async () => {
    const contenido = await crearXlsxPersonalizado((_libro, hoja) => {
      hoja.addRow(['Dato', 'Error']);
      hoja.addRow(['Valido', { error: '#N/A' }]);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.filas[0]).toEqual(['Valido', null]);
  });

  it('lee exclusivamente la primera hoja del libro', async () => {
    const contenido = await crearXlsxPersonalizado((libro, hoja) => {
      hoja.addRow(['Primera']);
      hoja.addRow(['Dato 1']);

      const segunda = libro.addWorksheet('Segunda');
      segunda.addRow(['Otra']);
      segunda.addRow(['Dato 2']);
    });

    const tabla = await new LectorXlsx().leer(contenido);

    expect(tabla.encabezados).toEqual(['Primera']);
    expect(tabla.filas).toEqual([['Dato 1']]);
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

  it('rechaza archivos que superan los 5 MB', () => {
    const contenido = Buffer.alloc(LIMITES_ARCHIVO.bytes + 1);

    expect(() => detectarTipo({ nombre: 'personal.csv', contenido })).toThrow(
      /supera los 5 MB/,
    );
  });
});
