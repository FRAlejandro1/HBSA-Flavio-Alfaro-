// Pruebas del calculo de periodos de vacaciones: fechas fijas, sin base de datos ni reloj.
import { describe, expect, it } from 'vitest';
import { calcularPeriodosVigentes, sumarAnios } from '../../../../src/modules/vacaciones/vacaciones.periodos';

describe('sumarAnios', () => {
  it('suma anios conservando el dia y el mes', () => {
    expect(sumarAnios('2026-10-15', 2)).toBe('2028-10-15');
    expect(sumarAnios('2026-10-15', 0)).toBe('2026-10-15');
  });

  it('el 29 de febrero pasa al 28 en los anios que no son bisiestos y se conserva en los que si', () => {
    expect(sumarAnios('2020-02-29', 1)).toBe('2021-02-28');
    expect(sumarAnios('2020-02-29', 4)).toBe('2024-02-29');
  });

  it('rechaza una fecha que no existe', () => {
    expect(() => sumarAnios('2026-02-31', 1)).toThrow(RangeError);
  });
});

describe('calcularPeriodosVigentes', () => {
  it('crea un periodo por cada aniversario que ya empezo y no ha caducado', () => {
    // 2022 y 2023 ya caducaron; 2024 caduco el 10 de enero de 2026; faltan 2025 y 2026
    expect(calcularPeriodosVigentes('2022-01-10', '2026-10-15')).toEqual([
      { fechaInicio: '2025-01-10', fechaCaducidad: '2027-01-10' },
      { fechaInicio: '2026-01-10', fechaCaducidad: '2028-01-10' },
    ]);
  });

  it('el mismo dia de ingreso ya hay un periodo', () => {
    expect(calcularPeriodosVigentes('2026-10-15', '2026-10-15')).toEqual([
      { fechaInicio: '2026-10-15', fechaCaducidad: '2028-10-15' },
    ]);
  });

  it('quien aun no ingresa no tiene periodos', () => {
    expect(calcularPeriodosVigentes('2026-10-16', '2026-10-15')).toEqual([]);
  });

  it('un periodo sigue vigente hasta su fecha de caducidad incluida', () => {
    expect(calcularPeriodosVigentes('2024-10-15', '2026-10-15').map((p) => p.fechaInicio)).toEqual([
      '2024-10-15',
      '2025-10-15',
      '2026-10-15',
    ]);
    expect(calcularPeriodosVigentes('2024-10-15', '2026-10-16').map((p) => p.fechaInicio)).toEqual([
      '2025-10-15',
      '2026-10-15',
    ]);
  });

  it('con ingreso el 29 de febrero, los aniversarios sin esa fecha caen el 28', () => {
    expect(calcularPeriodosVigentes('2020-02-29', '2026-10-15')).toEqual([
      { fechaInicio: '2025-02-28', fechaCaducidad: '2027-02-28' },
      { fechaInicio: '2026-02-28', fechaCaducidad: '2028-02-28' },
    ]);
  });

  it('rechaza una fecha de ingreso que no existe', () => {
    expect(() => calcularPeriodosVigentes('2026-02-31', '2026-10-15')).toThrow(RangeError);
  });
});