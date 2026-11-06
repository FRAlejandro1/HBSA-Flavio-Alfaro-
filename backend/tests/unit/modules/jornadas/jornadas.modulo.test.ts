import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  obtenerBaseDatosMock,
  authenticateMock,
  baseDatosMock,
  repositoryConstructorMock,
  serviceConstructorMock,
  serviceMock,
  controllerFactoryMock,
  controllerMock,
  routerFactoryMock,
  routerMock,
} = vi.hoisted(() => ({
  obtenerBaseDatosMock: vi.fn(),
  authenticateMock: vi.fn(),
  baseDatosMock: {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
    transaccion: vi.fn(),
    verificar: vi.fn(),
    cerrar: vi.fn(),
  },
  repositoryConstructorMock: vi.fn(),
  serviceConstructorMock: vi.fn<(dependencias: { repositorio: unknown }) => void>(),
  serviceMock: {},
  controllerFactoryMock: vi.fn(),
  controllerMock: {},
  routerFactoryMock: vi.fn(),
  routerMock: vi.fn(),
}));

vi.mock('../../../../src/config/database', () => ({
  obtenerBaseDatos: obtenerBaseDatosMock,
}));

vi.mock('../../../../src/middlewares/authenticate', () => ({
  authenticate: authenticateMock,
}));

vi.mock('../../../../src/modules/jornadas/jornadas.repository', () => ({
  JornadasRepository: class {
    constructor(bd: unknown) {
      repositoryConstructorMock(bd);
    }
  },
}));

vi.mock('../../../../src/modules/jornadas/jornadas.service', () => ({
  JornadasService: class {
    constructor(dependencias: { repositorio: unknown }) {
      serviceConstructorMock(dependencias);
      return serviceMock;
    }
  },
}));

vi.mock('../../../../src/modules/jornadas/jornadas.controller', () => ({
  crearJornadasController: controllerFactoryMock,
}));

vi.mock('../../../../src/modules/jornadas/jornadas.routes', () => ({
  crearJornadasRouter: routerFactoryMock,
}));

import { obtenerBaseDatos } from '../../../../src/config/database';
import { authenticate } from '../../../../src/middlewares/authenticate';
import {
  crearModuloJornadas,
  crearRouterJornadas,
} from '../../../../src/modules/jornadas/jornadas.modulo';

describe('ModuloJornadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    obtenerBaseDatosMock.mockReturnValue(baseDatosMock);
    controllerFactoryMock.mockReturnValue(controllerMock);
    routerFactoryMock.mockReturnValue(routerMock);
  });

  it('construye el módulo conectando la base de datos y el repositorio', () => {
    const modulo = crearModuloJornadas();

    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(obtenerBaseDatos).toHaveReturnedWith(baseDatosMock);
    expect(repositoryConstructorMock).toHaveBeenCalledWith(baseDatosMock);
    expect(serviceConstructorMock).toHaveBeenCalledOnce();
    expect(modulo.servicio).toBe(serviceMock);
    expect(modulo.router).toBe(routerMock);
  });

  it('construye el servicio con el repositorio correspondiente', () => {
    crearModuloJornadas();

    const dependencias = serviceConstructorMock.mock.calls[0]?.[0];

    if (!dependencias) {
      throw new Error('No se construyeron las dependencias de JornadasService');
    }

    expect(dependencias.repositorio).toBeDefined();
    expect(repositoryConstructorMock).toHaveBeenCalledOnce();
  });

  it('monta las rutas con el controlador y la autenticación', () => {
    crearModuloJornadas();

    expect(controllerFactoryMock).toHaveBeenCalledWith(serviceMock);
    expect(routerFactoryMock).toHaveBeenCalledWith({
      controller: controllerMock,
      autenticar: authenticate,
    });
    expect(authenticate).toBe(authenticateMock);
  });

  it('construye instancias independientes del módulo', () => {
    const primero = crearModuloJornadas();
    const segundo = crearModuloJornadas();

    expect(primero).not.toBe(segundo);
    expect(primero.router).toBe(routerMock);
    expect(segundo.router).toBe(routerMock);
    expect(obtenerBaseDatos).toHaveBeenCalledTimes(2);
    expect(repositoryConstructorMock).toHaveBeenCalledTimes(2);
    expect(serviceConstructorMock).toHaveBeenCalledTimes(2);
  });

  it('crea el router mediante la función de integración central', () => {
    const router = crearRouterJornadas();

    expect(router).toBe(routerMock);
    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(controllerFactoryMock).toHaveBeenCalledOnce();
    expect(routerFactoryMock).toHaveBeenCalledOnce();
  });
});