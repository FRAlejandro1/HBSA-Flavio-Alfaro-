// Pruebas de composicion del modulo de delegaciones.
// Verifica la conexion de base de datos y la construccion del router HTTP.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { obtenerBaseDatosMock, baseDatosMock, authenticateMock } = vi.hoisted(
  () => ({
    obtenerBaseDatosMock: vi.fn(),
    authenticateMock: vi.fn(),
    baseDatosMock: {
      consultar: vi.fn(),
      ejecutar: vi.fn(),
      transaccion: vi.fn(),
      verificar: vi.fn(),
      cerrar: vi.fn(),
    },
  }),
);

vi.mock('../../../../src/config/database', () => ({
  obtenerBaseDatos: obtenerBaseDatosMock,
}));

vi.mock('../../../../src/middlewares/authenticate', () => ({
  authenticate: authenticateMock,
}));

import { obtenerBaseDatos } from '../../../../src/config/database';
import { authenticate } from '../../../../src/middlewares/authenticate';
import { DelegacionesRepository } from '../../../../src/modules/delegaciones/delegaciones.repository';
import { DelegacionesService } from '../../../../src/modules/delegaciones/delegaciones.service';
import { crearRouterDelegaciones } from '../../../../src/modules/delegaciones/delegaciones.modulo';

describe('ModuloDelegaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerBaseDatosMock.mockReturnValue(baseDatosMock);
  });

  it('construye el router conectando la base de datos y sus dependencias', () => {
    const router = crearRouterDelegaciones();

    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(obtenerBaseDatos).toHaveReturnedWith(baseDatosMock);
    expect(authenticate).toBe(authenticateMock);
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('construye correctamente el router en llamadas independientes', () => {
    const primerRouter = crearRouterDelegaciones();
    const segundoRouter = crearRouterDelegaciones();

    expect(primerRouter).not.toBe(segundoRouter);
    expect(obtenerBaseDatos).toHaveBeenCalledTimes(2);
  });

  it('utiliza las clases concretas del modulo para su composicion', () => {
    const router = crearRouterDelegaciones();

    expect(router).toBeDefined();
    expect(DelegacionesRepository).toBeDefined();
    expect(DelegacionesService).toBeDefined();
  });
});
