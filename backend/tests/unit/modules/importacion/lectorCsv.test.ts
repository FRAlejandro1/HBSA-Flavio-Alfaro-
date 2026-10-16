// Pruebas del lector de CSV: separadores, comillas, codificaciones y filas vacias.
import { describe, expect, it } from 'vitest';
import { LectorCsv } from '../../../../src/modules/importacion/lectores/LectorCsv';

const lector = new LectorCsv();
const leer = (texto: string | Buffer) => lector.leer(Buffer.isBuffer(texto) ? texto : Buffer.from(texto, 'utf8'));

describe('LectorCsv', () => {
  it('lee encabezados y filas separados por comas', async () => {
    const tabla = await leer('Cedula,Nombres\n0102030405,Ana\n0102030406,Luis\n');
    expect(tabla.encabezados).toEqual(['Cedula', 'Nombres']);
    expect(tabla.filas).toEqual([
      ['0102030405', 'Ana'],
      ['0102030406', 'Luis'],
    ]);
  });

  it('detecta el punto y coma que usa Excel en espanol', async () => {
    const tabla = await leer('Cedula;Nombres\r\n0102030405;Ana\r\n');
    expect(tabla.encabezados).toEqual(['Cedula', 'Nombres']);
    expect(tabla.filas).toEqual([['0102030405', 'Ana']]);
  });

  it('respeta las comillas, el separador dentro de ellas y las comillas escapadas', async () => {
    const tabla = await leer('Nombre,Nota\n"Perez, Ana","Dijo ""hola"""\n');
    expect(tabla.filas).toEqual([['Perez, Ana', 'Dijo "hola"']]);
  });

  it('quita el BOM y lee UTF-8 con tildes', async () => {
    const tabla = await leer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Área,Cédula\nEmergencia,1\n')]));
    expect(tabla.encabezados).toEqual(['Área', 'Cédula']);
  });

  it('cae a Latin-1 cuando el archivo no es UTF-8', async () => {
    const tabla = await leer(Buffer.from('Área;Cédula\nEmergencia;1\n', 'latin1'));
    expect(tabla.encabezados).toEqual(['Área', 'Cédula']);
  });

  it('descarta filas vacias y deja las celdas vacias en null', async () => {
    const tabla = await leer('A,B\n\n1,\n,,\n2,3\n');
    expect(tabla.filas).toEqual([
      ['1', null],
      ['2', '3'],
    ]);
  });

  it('completa las filas cortas y recorta las largas al ancho de los encabezados', async () => {
    const tabla = await leer('A,B\n1\n1,2,3\n');
    expect(tabla.filas).toEqual([
      ['1', null],
      ['1', '2'],
    ]);
  });

  it('rechaza un archivo vacio', async () => {
    await expect(leer('   \n')).rejects.toMatchObject({ codigo: 'VALIDACION' });
  });
});