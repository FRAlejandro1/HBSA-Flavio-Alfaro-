// Pruebas de zonaHoraria: dia de calendario de un instante segun la zona del negocio.
import { describe, expect, it } from 'vitest';
import {
  ZONA_HORARIA_POR_DEFECTO,
  esZonaHorariaValida,
  fechaEnZona,
  hoyEnZona,
} from '../../../src/shared/utils/zonaHoraria';

describe('fechaEnZona', () => {
  it('en Ecuador (UTC-5) las 03:00 UTC todavia son el dia anterior', () => {
    expect(fechaEnZona(new Date('2026-10-10T03:00:00Z'), 'America/Guayaquil')).toBe('2026-10-09');
  });

  it('el cambio de dia en Ecuador ocurre a las 05:00 UTC', () => {
    expect(fechaEnZona(new Date('2026-10-10T04:59:59Z'), 'America/Guayaquil')).toBe('2026-10-09');
    expect(fechaEnZona(new Date('2026-10-10T05:00:00Z'), 'America/Guayaquil')).toBe('2026-10-10');
  });

  it('en UTC la fecha es la misma del instante', () => {
    expect(fechaEnZona(new Date('2026-10-10T03:00:00Z'), 'UTC')).toBe('2026-10-10');
  });
});

describe('hoyEnZona', () => {
  it('usa la zona de Ecuador por defecto', () => {
    expect(ZONA_HORARIA_POR_DEFECTO).toBe('America/Guayaquil');
    expect(hoyEnZona(undefined, new Date('2026-10-10T03:00:00Z'))).toBe('2026-10-09');
  });
});

describe('esZonaHorariaValida', () => {
  it('acepta una zona real y rechaza una inventada', () => {
    expect(esZonaHorariaValida('America/Guayaquil')).toBe(true);
    expect(esZonaHorariaValida('Marte/Olimpo')).toBe(false);
    expect(esZonaHorariaValida('')).toBe(false);
  });
});