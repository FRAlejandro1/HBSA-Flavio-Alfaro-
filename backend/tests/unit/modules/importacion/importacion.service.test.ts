// Pruebas del service de importacion con repositorio en memoria y lector de archivos real (CSV).
import { describe, expect, it } from 'vitest';
import { ImportacionService } from '../../../../src/modules/importacion/importacion.service';
import { leerTabla } from '../../../../src/modules/importacion/lectores';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import { crearImportacionEnMemoria, usuarioExistente } from '../../../helpers/importacion';

const actor: UsuarioAutenticado = {
  id: 99,
  empresaId: 5,
  rol: 'TALENTO_HUMANO',
  jti: 'jti-th',
  expira: 9_999_999_999,
};

const CSV_VALIDO = [
  'Cedula;Nombres;Apellidos;Area;Cargo;Fecha de ingreso',
  '0200000001;Rosa;Mena;Emergencia;Medico;10/05/2021',
].join('\n');

function crearEscenario() {
  const memoria = crearImportacionEnMemoria({
    areas: [{ id: 1, detalle: 'Emergencia' }],
    cargos: [{ id: 1, detalle: 'Médico' }],
    usuarios: [usuarioExistente()],
  });
  const servicio = new ImportacionService({
    repositorio: memoria.repositorio,
    leerTabla,
    hoy: () => '2026-10-13',
  });
  return { servicio, ...memoria };
}

const archivo = (texto: string) => ({ nombre: 'personal.csv', contenido: Buffer.from(texto, 'utf8') });
const sinOpciones = { mapeo: {}, bajaAusentes: false };

describe('revisar', () => {
  it('devuelve el resumen, las columnas reconocidas y una huella', async () => {
    const { servicio, planesAplicados } = crearEscenario();
    const revision = await servicio.revisar(actor, archivo(CSV_VALIDO), sinOpciones);
    expect(revision.archivo).toEqual({ nombre: 'personal.csv', tipo: 'csv', filas: 1 });
    expect(revision.resumen.crear).toBe(1);
    expect(revision.puedeAplicar).toBe(true);
    expect(revision.huella).toMatch(/^[0-9a-f]{64}$/);
    // Revisar nunca guarda nada
    expect(planesAplicados).toHaveLength(0);
  });

  it('la huella cambia si cambia el archivo o las opciones', async () => {
    const { servicio } = crearEscenario();
    const base = await servicio.revisar(actor, archivo(CSV_VALIDO), sinOpciones);
    const otroArchivo = await servicio.revisar(actor, archivo(`${CSV_VALIDO}\n`), sinOpciones);
    const otraOpcion = await servicio.revisar(actor, archivo(CSV_VALIDO), { mapeo: {}, bajaAusentes: true });
    expect(otroArchivo.huella).not.toBe(base.huella);
    expect(otraOpcion.huella).not.toBe(base.huella);
    expect((await servicio.revisar(actor, archivo(CSV_VALIDO), sinOpciones)).huella).toBe(base.huella);
  });
});

describe('aplicar', () => {
  it('aplica el plan cuando la huella coincide', async () => {
    const { servicio, planesAplicados } = crearEscenario();
    const { huella } = await servicio.revisar(actor, archivo(CSV_VALIDO), sinOpciones);
    const resultado = await servicio.aplicar(actor, archivo(CSV_VALIDO), sinOpciones, huella);
    expect(resultado).toEqual({ creadas: 1, actualizadas: 0, bajas: 0, ausentesDadosDeBaja: 0, sinCambios: 0 });
    expect(planesAplicados[0]?.crear[0]?.cedula).toBe('0200000001');
  });

  it('rechaza con 409 un archivo distinto del revisado y no guarda nada', async () => {
    const { servicio, planesAplicados } = crearEscenario();
    const { huella } = await servicio.revisar(actor, archivo(CSV_VALIDO), sinOpciones);
    const otro = CSV_VALIDO.replace('Rosa', 'Rosita');
    await expect(servicio.aplicar(actor, archivo(otro), sinOpciones, huella)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
    expect(planesAplicados).toHaveLength(0);
  });

  it('rechaza con 422 una revision con errores', async () => {
    const { servicio, planesAplicados } = crearEscenario();
    const conError = CSV_VALIDO.replace('Emergencia', 'Quirofano');
    const { huella } = await servicio.revisar(actor, archivo(conError), sinOpciones);
    await expect(servicio.aplicar(actor, archivo(conError), sinOpciones, huella)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
    expect(planesAplicados).toHaveLength(0);
  });

  it('rechaza cuando no hay nada que cambiar', async () => {
    const { servicio } = crearEscenario();
    const sinCambios = [
      'Cedula,Nombres,Apellidos,Area,Cargo,Fecha de ingreso',
      '0102030405,Ana,Perez,Emergencia,Medico,2020-03-01',
    ].join('\n');
    const { huella } = await servicio.revisar(actor, archivo(sinCambios), sinOpciones);
    await expect(servicio.aplicar(actor, archivo(sinCambios), sinOpciones, huella)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });
});