// Pruebas de fechas. En octubre de 2026 el dia 5 es lunes y el 10 es sabado.
import { describe, expect, it } from 'vitest';
import {
  calcularDiasLaborables,
  calcularFechaFin,
  diasDeAnticipacion,
  diferenciaEnDias,
  esFinDeSemana,
  esProgramada,
  parsearFecha,
  sumarDias,
} from '../../../src/shared/utils/fechas';

const sinFeriados: ReadonlySet<string> = new Set();

describe('parsearFecha', () => {
  it('acepta una fecha valida', () => {
    expect(parsearFecha('2026-10-08').toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('rechaza formatos y fechas inexistentes', () => {
    expect(() => parsearFecha('08/10/2026')).toThrow(RangeError);
    expect(() => parsearFecha('2026-02-31')).toThrow(RangeError);
  });
});

describe('sumarDias y diferenciaEnDias', () => {
  it('suma dias cruzando el fin de anio', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('resta con numeros negativos', () => {
    expect(sumarDias('2026-10-05', -1)).toBe('2026-10-04');
  });

  it('calcula la diferencia en dias calendario', () => {
    expect(diferenciaEnDias('2026-10-05', '2026-10-12')).toBe(7);
    expect(diferenciaEnDias('2026-10-12', '2026-10-05')).toBe(-7);
  });
});

describe('esFinDeSemana', () => {
  it('detecta sabado y domingo', () => {
    expect(esFinDeSemana('2026-10-10')).toBe(true);
    expect(esFinDeSemana('2026-10-11')).toBe(true);
    expect(esFinDeSemana('2026-10-09')).toBe(false);
  });
});

describe('calcularDiasLaborables', () => {
  it('cuenta solo de lunes a viernes', () => {
    expect(calcularDiasLaborables('2026-10-05', '2026-10-11', sinFeriados)).toBe(5);
  });

  it('excluye los feriados', () => {
    expect(calcularDiasLaborables('2026-10-05', '2026-10-11', new Set(['2026-10-07']))).toBe(4);
  });

  it('rechaza un rango invertido', () => {
    expect(() => calcularDiasLaborables('2026-10-12', '2026-10-05', sinFeriados)).toThrow(
      RangeError,
    );
  });
});

describe('calcularFechaFin', () => {
  it('termina el viernes si pide cinco dias desde el lunes', () => {
    expect(calcularFechaFin('2026-10-05', 5, sinFeriados)).toBe('2026-10-09');
  });

  it('salta el fin de semana', () => {
    expect(calcularFechaFin('2026-10-05', 6, sinFeriados)).toBe('2026-10-12');
  });

  it('salta los feriados', () => {
    expect(calcularFechaFin('2026-10-05', 5, new Set(['2026-10-07']))).toBe('2026-10-12');
  });

  it('una fraccion de dia ocupa el dia completo', () => {
    expect(calcularFechaFin('2026-10-05', 0.5, sinFeriados)).toBe('2026-10-05');
  });

  it('rechaza cantidades no positivas', () => {
    expect(() => calcularFechaFin('2026-10-05', 0, sinFeriados)).toThrow(RangeError);
  });
});

describe('esProgramada', () => {
  it('es programada con 7 dias de anticipacion o mas', () => {
    expect(diasDeAnticipacion('2026-10-08', '2026-10-15')).toBe(7);
    expect(esProgramada('2026-10-08', '2026-10-15')).toBe(true);
  });

  it('no es programada con menos de 7 dias', () => {
    expect(esProgramada('2026-10-08', '2026-10-14')).toBe(false);
  });
});