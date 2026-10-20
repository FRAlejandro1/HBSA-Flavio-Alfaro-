import { FILTROS_SOLICITUDES, ESTADOS_SOLICITUD } from '@/features/dashboard/dashboard.constants';
import { fechaLegible, obtenerNombreCompleto } from '@/features/dashboard/dashboard.utils';
import { describe, expect, it } from 'vitest';

describe('Constantes del dashboard', () => {
  it('define las etiquetas de todos los estados', () => {
    expect(Object.keys(ESTADOS_SOLICITUD)).toHaveLength(5);
    expect(ESTADOS_SOLICITUD.PENDIENTE).toBe('Pendiente');
    expect(ESTADOS_SOLICITUD.VISTO_BUENO).toBe('En revisión');
    expect(ESTADOS_SOLICITUD.AUTORIZADA).toBe('Autorizada');
    expect(ESTADOS_SOLICITUD.NEGADA).toBe('Negada');
    expect(ESTADOS_SOLICITUD.CANCELADA).toBe('Cancelada');
  });

  it('define los filtros disponibles en el orden esperado', () => {
    expect(FILTROS_SOLICITUDES.map(({ value }) => value)).toEqual([
      'TODAS',
      'VACACIONES',
      'PERMISOS',
      'LICENCIAS',
    ]);
  });
});

describe('Utilidades del dashboard', () => {
  it('formatea una fecha ISO como fecha legible en español', () => {
    expect(fechaLegible('2026-11-10')).toMatch(/10/);
    expect(fechaLegible('2026-11-10')).toMatch(/2026/);
  });

  it('devuelve el texto original si la fecha es inválida', () => {
    expect(fechaLegible('fecha-invalida')).toBe('fecha-invalida');
  });

  it('compone el nombre completo', () => {
    expect(obtenerNombreCompleto('Ana', 'Pérez')).toBe('Ana Pérez');
  });

  it('elimina los espacios exteriores del nombre completo', () => {
    expect(obtenerNombreCompleto(' Ana ', ' Pérez ')).toBe('Ana   Pérez');
    expect(obtenerNombreCompleto('', '')).toBe('');
  });
});
