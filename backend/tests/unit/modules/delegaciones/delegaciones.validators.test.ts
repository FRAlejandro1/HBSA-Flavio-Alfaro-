// Pruebas unitarias de las validaciones de delegaciones institucionales.
// Verifica tipos, formatos, transformaciones, valores predeterminados y reglas temporales.

import { describe, expect, it } from 'vitest';
import {
  esquemaCrearDelegacion,
  esquemaFiltrosDelegaciones,
} from '../../../../src/modules/delegaciones/delegaciones.validators';

describe('esquemaCrearDelegacion', () => {
  const entradaValida = {
    deleganteId: 10,
    delegadoId: 20,
    vigenteDesde: '2026-11-01T08:00:00-05:00',
    vigenteHasta: '2026-11-10T17:00:00-05:00',
    motivo: ' Cobertura temporal ',
  };

  it('valida los datos y transforma las fechas y el motivo', () => {
    const resultado = esquemaCrearDelegacion.safeParse(entradaValida);

    expect(resultado.success).toBe(true);

    if (!resultado.success) return;

    expect(resultado.data.deleganteId).toBe(10);
    expect(resultado.data.delegadoId).toBe(20);
    expect(resultado.data.vigenteDesde).toBeInstanceOf(Date);
    expect(resultado.data.vigenteHasta).toBeInstanceOf(Date);
    expect(resultado.data.motivo).toBe('Cobertura temporal');
  });

  it('permite omitir el deleganteId', () => {
    const entrada = Object.fromEntries(Object.entries(entradaValida).filter(([clave]) => clave !== 'deleganteId'));

    const resultado = esquemaCrearDelegacion.safeParse(entrada);

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.deleganteId).toBeUndefined();
    }
  });

  it('rechaza un deleganteId que no sea entero positivo', () => {
    for (const deleganteId of [0, -1, 1.5, '10', null]) {
      const resultado = esquemaCrearDelegacion.safeParse({
        ...entradaValida,
        deleganteId,
      });

      expect(resultado.success).toBe(false);
    }
  });

  it('rechaza un delegadoId que no sea entero positivo', () => {
    for (const delegadoId of [0, -1, 1.5, '20', null, undefined]) {
      const resultado = esquemaCrearDelegacion.safeParse({
        ...entradaValida,
        delegadoId,
      });

      expect(resultado.success).toBe(false);
    }
  });

  it('rechaza fechas sin zona horaria o con formato inválido', () => {
    for (const vigenteDesde of [
      '2026-11-01T08:00:00',
      'fecha-invalida',
      '',
      null,
    ]) {
      const resultado = esquemaCrearDelegacion.safeParse({
        ...entradaValida,
        vigenteDesde,
      });

      expect(resultado.success).toBe(false);
    }
  });

  it('rechaza una fecha de finalización igual a la fecha de inicio', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      vigenteHasta: entradaValida.vigenteDesde,
    });

    expect(resultado.success).toBe(false);

    if (!resultado.success) {
      expect(
        resultado.error.issues.some(
          (issue) =>
            issue.path.includes('vigenteHasta') &&
            issue.message ===
              'La fecha de finalizacion debe ser posterior a la fecha de inicio',
        ),
      ).toBe(true);
    }
  });

  it('rechaza una fecha de finalización anterior a la fecha de inicio', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      vigenteHasta: '2026-10-31T08:00:00-05:00',
    });

    expect(resultado.success).toBe(false);
  });

  it('convierte un motivo ausente en null', () => {
    const entrada = Object.fromEntries(Object.entries(entradaValida).filter(([clave]) => clave !== 'motivo'));

    const resultado = esquemaCrearDelegacion.safeParse(entrada);

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.motivo).toBeNull();
    }
  });

  it('conserva null como motivo', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      motivo: null,
    });

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.motivo).toBeNull();
    }
  });

  it('recorta espacios del motivo', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      motivo: '   Motivo válido   ',
    });

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.motivo).toBe('Motivo válido');
    }
  });

  it('rechaza motivos con más de 300 caracteres', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      motivo: 'a'.repeat(301),
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta motivos de exactamente 300 caracteres', () => {
    const resultado = esquemaCrearDelegacion.safeParse({
      ...entradaValida,
      motivo: 'a'.repeat(300),
    });

    expect(resultado.success).toBe(true);
  });

  it('rechaza motivos que no sean texto ni null', () => {
    for (const motivo of [123, false, {}, []]) {
      const resultado = esquemaCrearDelegacion.safeParse({
        ...entradaValida,
        motivo,
      });

      expect(resultado.success).toBe(false);
    }
  });
});

describe('esquemaFiltrosDelegaciones', () => {
  it('aplica los valores predeterminados de paginación', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({});

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.pagina).toBe(1);
      expect(resultado.data.porPagina).toBe(20);
    }
  });

  it('convierte los identificadores de texto a números', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      deleganteId: '10',
      delegadoId: '20',
    });

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.deleganteId).toBe(10);
      expect(resultado.data.delegadoId).toBe(20);
    }
  });

  it('convierte los parámetros de paginación a números', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      pagina: '3',
      porPagina: '50',
    });

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.pagina).toBe(3);
      expect(resultado.data.porPagina).toBe(50);
    }
  });

  it('acepta todos los estados permitidos', () => {
    for (const estado of [
      'PROGRAMADA',
      'VIGENTE',
      'VENCIDA',
      'REVOCADA',
    ]) {
      const resultado = esquemaFiltrosDelegaciones.safeParse({ estado });

      expect(resultado.success).toBe(true);
    }
  });

  it('rechaza estados no permitidos', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      estado: 'PENDIENTE',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza identificadores que no sean enteros positivos', () => {
    for (const deleganteId of ['0', '-1', '1.5', 'invalido']) {
      const resultado = esquemaFiltrosDelegaciones.safeParse({
        deleganteId,
      });

      expect(resultado.success).toBe(false);
    }

    for (const delegadoId of ['0', '-1', '1.5', 'invalido']) {
      const resultado = esquemaFiltrosDelegaciones.safeParse({
        delegadoId,
      });

      expect(resultado.success).toBe(false);
    }
  });

  it('rechaza páginas que no sean enteros positivos', () => {
    for (const pagina of ['0', '-1', '1.5', 'invalido']) {
      const resultado = esquemaFiltrosDelegaciones.safeParse({ pagina });

      expect(resultado.success).toBe(false);
    }
  });

  it('rechaza porPagina menor que 1', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      porPagina: '0',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza porPagina mayor que 100', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      porPagina: '101',
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta los límites de porPagina', () => {
    for (const porPagina of ['1', '100']) {
      const resultado = esquemaFiltrosDelegaciones.safeParse({
        porPagina,
      });

      expect(resultado.success).toBe(true);
    }
  });

  it('rechaza porPagina que no sea un número entero', () => {
    const resultado = esquemaFiltrosDelegaciones.safeParse({
      porPagina: '2.5',
    });

    expect(resultado.success).toBe(false);
  });
});
