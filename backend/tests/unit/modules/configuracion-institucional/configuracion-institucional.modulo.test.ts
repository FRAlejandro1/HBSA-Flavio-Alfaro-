// Pruebas de composicion del modulo de configuracion institucional.
// Verifica la construccion del servicio y la exposicion del router.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { obtenerBaseDatosMock, baseDatosMock } = vi.hoisted(() => ({
  obtenerBaseDatosMock: vi.fn(),
  baseDatosMock: {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
    transaccion: vi.fn(),
    verificar: vi.fn(),
    cerrar: vi.fn(),
  },
}));

vi.mock('../../../../src/config/database', () => ({
  obtenerBaseDatos: obtenerBaseDatosMock,
}));

import { obtenerBaseDatos } from '../../../../src/config/database';
import { ConfiguracionInstitucionalService } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.service';
import {
  crearModuloConfiguracionInstitucional,
  crearRouterConfiguracionInstitucional,
} from '../../../../src/modules/configuracion-institucional/configuracion-institucional.modulo';

describe('ModuloConfiguracionInstitucional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerBaseDatosMock.mockReturnValue(baseDatosMock);
  });

  it('construye el servicio y el router del modulo', () => {
    const modulo = crearModuloConfiguracionInstitucional();

    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(modulo.router).toBeDefined();
    expect(modulo.servicio).toBeInstanceOf(ConfiguracionInstitucionalService);
  });

  it('expone el router para el montaje central de la API', () => {
    const router = crearRouterConfiguracionInstitucional();

    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
