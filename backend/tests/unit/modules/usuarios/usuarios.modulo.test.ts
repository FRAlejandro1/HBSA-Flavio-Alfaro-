// Pruebas unitarias de la composicion del modulo de usuarios.
// Verifica la construccion del servicio, el controller y el router,
// incluyendo la funcion de fecha de negocio.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearRouterUsuarios } from '../../../../src/modules/usuarios/usuarios.modulo';

const mocks = vi.hoisted(() => ({
  obtenerBaseDatos: vi.fn(),
  authenticate: vi.fn(),
  hashearClave: vi.fn(),
  hoyEnZona: vi.fn(),
  repositorio: { tipo: 'repositorio' },
  servicio: { tipo: 'servicio' },
  controller: { tipo: 'controller' },
  router: { tipo: 'router' },
  opcionesServicio: undefined as
    | {
        repositorio: unknown;
        hashear: unknown;
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

vi.mock('../../../../src/shared/security/password', () => ({
  hashearClave: mocks.hashearClave,
}));

vi.mock('../../../../src/shared/utils/zonaHoraria', () => ({
  hoyEnZona: mocks.hoyEnZona,
}));

vi.mock('../../../../src/modules/usuarios/usuarios.controller', () => ({
  crearUsuariosController: vi.fn(() => mocks.controller),
}));

vi.mock('../../../../src/modules/usuarios/usuarios.repository', () => ({
  UsuariosRepository: vi.fn(() => mocks.repositorio),
}));

vi.mock('../../../../src/modules/usuarios/usuarios.routes', () => ({
  crearUsuariosRouter: vi.fn(() => mocks.router),
}));

vi.mock('../../../../src/modules/usuarios/usuarios.service', () => ({
  UsuariosService: vi.fn((opciones: NonNullable<typeof mocks.opcionesServicio>) => {
    mocks.opcionesServicio = opciones;
    return mocks.servicio;
  }),
}));

import { crearUsuariosController } from '../../../../src/modules/usuarios/usuarios.controller';
import { UsuariosRepository } from '../../../../src/modules/usuarios/usuarios.repository';
import { crearUsuariosRouter } from '../../../../src/modules/usuarios/usuarios.routes';
import { UsuariosService } from '../../../../src/modules/usuarios/usuarios.service';

describe('crearRouterUsuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.opcionesServicio = undefined;
    mocks.obtenerBaseDatos.mockReturnValue({
      conexion: 'base-datos',
    });
    mocks.hoyEnZona.mockReturnValue('2026-11-05');
  });

  it('construye el servicio, el controller y el router de usuarios', () => {
    const router = crearRouterUsuarios();

    expect(mocks.obtenerBaseDatos).toHaveBeenCalledOnce();

    expect(UsuariosRepository).toHaveBeenCalledWith({
      conexion: 'base-datos',
    });

    expect(UsuariosService).toHaveBeenCalledOnce();
    expect(mocks.opcionesServicio).toMatchObject({
      repositorio: mocks.repositorio,
      hashear: mocks.hashearClave,
    });
    expect(typeof mocks.opcionesServicio?.hoy).toBe('function');

    expect(crearUsuariosController).toHaveBeenCalledWith(
      mocks.servicio,
    );

    expect(crearUsuariosRouter).toHaveBeenCalledWith({
      controller: mocks.controller,
      autenticar: mocks.authenticate,
    });

    expect(router).toBe(mocks.router);
  });

  it('obtiene la fecha usando la zona horaria de negocio', () => {
    crearRouterUsuarios();

    expect(mocks.opcionesServicio).toBeDefined();

    const fecha = mocks.opcionesServicio!.hoy();

    expect(mocks.hoyEnZona).toHaveBeenCalledWith(
      'America/Guayaquil',
    );
    expect(fecha).toBe('2026-11-05');
  });
});
