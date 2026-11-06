// Pruebas unitarias de la composicion del modulo de importacion.
// Verifica la construccion del servicio, el controller y el router,
// incluyendo la funcion de fecha de negocio.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearRouterImportacion } from '../../../../src/modules/importacion/importacion.modulo';

const mocks = vi.hoisted(() => ({
  obtenerBaseDatos: vi.fn(),
  authenticate: vi.fn(),
  hoyEnZona: vi.fn(),
  leerTabla: vi.fn(),
  repositorio: { tipo: 'repositorio' },
  servicio: { tipo: 'servicio' },
  controller: { tipo: 'controller' },
  router: { tipo: 'router' },
  opcionesServicio: undefined as
    | {
        repositorio: unknown;
        leerTabla: unknown;
        hoy: () => unknown;
      }
    | undefined,
}));

vi.mock('../../../../src/config/database', () => ({
  obtenerBaseDatos: mocks.obtenerBaseDatos,
}));

vi.mock('../../../../src/config/env', () => ({
  env: {
    ZONA_HORARIA_NEGOCIO: 'America/Guayaquil',
  },
}));

vi.mock('../../../../src/middlewares/authenticate', () => ({
  authenticate: mocks.authenticate,
}));

vi.mock('../../../../src/shared/utils/zonaHoraria', () => ({
  hoyEnZona: mocks.hoyEnZona,
}));

vi.mock('../../../../src/modules/importacion/importacion.controller', () => ({
  crearImportacionController: vi.fn(() => mocks.controller),
}));

vi.mock('../../../../src/modules/importacion/importacion.repository', () => ({
  ImportacionRepository: vi.fn(() => mocks.repositorio),
}));

vi.mock('../../../../src/modules/importacion/importacion.routes', () => ({
  crearImportacionRouter: vi.fn(() => mocks.router),
}));

vi.mock('../../../../src/modules/importacion/importacion.service', () => ({
  ImportacionService: vi.fn((opciones: NonNullable<typeof mocks.opcionesServicio>) => {
    mocks.opcionesServicio = opciones;
    return mocks.servicio;
  }),
}));

vi.mock('../../../../src/modules/importacion/lectores', () => ({
  leerTabla: mocks.leerTabla,
}));

import { crearImportacionController } from '../../../../src/modules/importacion/importacion.controller';
import { ImportacionRepository } from '../../../../src/modules/importacion/importacion.repository';
import { crearImportacionRouter } from '../../../../src/modules/importacion/importacion.routes';
import { ImportacionService } from '../../../../src/modules/importacion/importacion.service';

describe('crearRouterImportacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.opcionesServicio = undefined;
    mocks.obtenerBaseDatos.mockReturnValue({ conexion: 'base-datos' });
    mocks.hoyEnZona.mockReturnValue('2026-11-05');
  });

  it('construye el servicio, el controller y el router de importacion', () => {
    const router = crearRouterImportacion();

    expect(mocks.obtenerBaseDatos).toHaveBeenCalledOnce();

    expect(ImportacionRepository).toHaveBeenCalledWith({
      conexion: 'base-datos',
    });

    expect(ImportacionService).toHaveBeenCalledOnce();
    expect(mocks.opcionesServicio).toMatchObject({
      repositorio: mocks.repositorio,
      leerTabla: mocks.leerTabla,
    });
    expect(typeof mocks.opcionesServicio?.hoy).toBe('function');

    expect(crearImportacionController).toHaveBeenCalledWith(
      mocks.servicio,
    );

    expect(crearImportacionRouter).toHaveBeenCalledWith({
      controller: mocks.controller,
      autenticar: mocks.authenticate,
    });

    expect(router).toBe(mocks.router);
  });

  it('obtiene la fecha usando la zona horaria de negocio', () => {
    crearRouterImportacion();

    expect(mocks.opcionesServicio).toBeDefined();

    const fecha: unknown = mocks.opcionesServicio!.hoy();

    expect(mocks.hoyEnZona).toHaveBeenCalledWith(
      'America/Guayaquil',
    );
    expect(fecha).toBe('2026-11-05');
  });
});
