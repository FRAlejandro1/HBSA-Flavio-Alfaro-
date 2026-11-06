// Pruebas unitarias de armado y validacion de tablas crudas de importacion.
import { describe, expect, it } from 'vitest';
import { armarTabla } from '../../../../src/modules/importacion/lectores/tabla';
import { LIMITES_ARCHIVO } from '../../../../src/modules/importacion/lectores/tipos';

describe('armarTabla', () => {
  it('rechaza una entrada sin filas', () => {
    expect(() => armarTabla([])).toThrow('El archivo no tiene datos');
  });

  it('rechaza filas compuestas exclusivamente por celdas nulas', () => {
    expect(() => armarTabla([[null], [null, null]])).toThrow('El archivo no tiene datos');
  });

  it('descarta filas vacias, incluso arreglos sin celdas', () => {
    const tabla = armarTabla([
      [],
      [null, null],
      [' Nombre ', ' Edad '],
      [],
      [' Ana ', 25],
    ]);

    expect(tabla.encabezados).toEqual(['Nombre', 'Edad']);
    expect(tabla.filas).toEqual([[' Ana ', 25]]);
  });

  it('convierte encabezados nulos en cadenas vacias y normaliza sus valores', () => {
    const tabla = armarTabla([
      [' Nombre ', null, 123, true, new Date('2020-01-01')],
      ['Ana', 'Dato', 456, false, null],
    ]);

    expect(tabla.encabezados).toEqual([
      'Nombre',
      '',
      '123',
      'true',
      new Date('2020-01-01').toString(),
    ]);
  });

  it('descarta las columnas nulas al final de los encabezados', () => {
    const tabla = armarTabla([
      ['Nombre', 'Edad', null, null],
      ['Ana', 25, 'Ignorada', 'Ignorada'],
    ]);

    expect(tabla.encabezados).toEqual(['Nombre', 'Edad']);
    expect(tabla.filas).toEqual([['Ana', 25]]);
  });

  it('rechaza encabezados sin columnas', () => {
    expect(() => armarTabla([[]])).toThrow('El archivo no tiene datos');
  });

  it('rechaza encabezados compuestos solo por valores nulos', () => {
    expect(() => armarTabla([[null, null, null]])).toThrow('El archivo no tiene datos');
  });

  it('rechaza tablas que superan el maximo de columnas', () => {
    const encabezados = Array.from(
      { length: LIMITES_ARCHIVO.columnas + 1 },
      (_, i) => `Columna ${i + 1}`,
    );

    expect(() => armarTabla([encabezados])).toThrow(
      `El archivo debe tener entre 1 y ${LIMITES_ARCHIVO.columnas} columnas`,
    );
  });

  it('rechaza tablas que superan el maximo de filas de datos', () => {
    const filas: (string | null)[][] = [['Encabezado']];

    for (let i = 0; i <= LIMITES_ARCHIVO.filas; i++) {
      filas.push([`Dato ${i + 1}`]);
    }

    expect(() => armarTabla(filas)).toThrow(
      `El archivo supera el maximo de ${LIMITES_ARCHIVO.filas} filas`,
    );
  });

  it('permite exactamente el maximo de filas de datos', () => {
    const filas: (string | null)[][] = [['Encabezado']];

    for (let i = 0; i < LIMITES_ARCHIVO.filas; i++) {
      filas.push([`Dato ${i + 1}`]);
    }

    const tabla = armarTabla(filas);

    expect(tabla.filas).toHaveLength(LIMITES_ARCHIVO.filas);
  });

  it('completa con nulos las celdas faltantes y recorta las sobrantes', () => {
    const tabla = armarTabla([
      ['A', 'B', 'C'],
      ['Dato'],
      ['Otro', null],
      ['Extra', 'Valor', 'Final', 'Ignorada'],
    ]);

    expect(tabla.filas).toEqual([
      ['Dato', null, null],
      ['Otro', null, null],
      ['Extra', 'Valor', 'Final'],
    ]);
  });

  it('convierte valores indefinidos de las filas en nulos', () => {
    const filas = [
      ['A', 'B'],
      ['Dato', undefined],
    ] as unknown as (string | null)[][];

    const tabla = armarTabla(filas);

    expect(tabla.filas).toEqual([['Dato', null]]);
  });

  it('considera una fila con valores distintos de null como no vacia', () => {
    const tabla = armarTabla([
      [undefined] as unknown as (string | null)[],
      ['Encabezado'],
      ['Dato'],
    ]);

    expect(tabla.encabezados).toEqual(['undefined']);
    expect(tabla.filas).toEqual([['Encabezado'], ['Dato']]);
  });
});

