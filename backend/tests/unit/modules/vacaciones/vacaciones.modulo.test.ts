// Pruebas de composición del módulo de vacaciones.
// Verifica dependencias, configuración institucional y montaje HTTP.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ConfiguracionInstitucionalPrueba {
  plazoHoras: number;
  diasVacacionesAnuales: number;
  zonaHoraria: string;
  diasAnticipacionVacaciones: number;
}

interface DependenciasPeriodosPrueba {
  obtenerDiasVacacionesAnuales: (empresaId: number) => Promise<number>;
}

interface DependenciasVacacionesPrueba {
  obtenerConfiguracionInstitucional: (
    empresaId: number,
  ) => Promise<ConfiguracionInstitucionalPrueba | null>;
  calcularDiasLaborables: (...argumentos: never[]) => number;
  asegurarPeriodos: (
    empresaId: number,
    usuarioId: number,
    hoy: Date,
  ) => Promise<void>;
}

const {
  obtenerBaseDatosMock,
  authenticateMock,
  baseDatosMock,
  obtenerConfiguracionMock,
  configurarRepositoryConstructorMock,
  periodosRepositoryConstructorMock,
  periodosServiceConstructorMock,
  asegurarPeriodosMock,
  vacacionesRepositoryConstructorMock,
  vacacionesServiceConstructorMock,
  servicioMock,
  controllerFactoryMock,
  routerFactoryMock,
  controllerMock,
  middlewareMock,
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
  obtenerConfiguracionMock: vi.fn<(empresaId: number) => Promise<ConfiguracionInstitucionalPrueba | null>>(),
  configurarRepositoryConstructorMock: vi.fn(),
  periodosRepositoryConstructorMock: vi.fn(),
  periodosServiceConstructorMock: vi.fn<(dependencias: DependenciasPeriodosPrueba) => void>(),
  asegurarPeriodosMock: vi.fn<(empresaId: number, usuarioId: number, hoy: Date) => Promise<void>>(),
  vacacionesRepositoryConstructorMock: vi.fn(),
  vacacionesServiceConstructorMock: vi.fn<(dependencias: DependenciasVacacionesPrueba) => void>(),
  servicioMock: {},
  controllerFactoryMock: vi.fn(),
  routerFactoryMock: vi.fn(),
  controllerMock: {},
  middlewareMock: vi.fn(),
}));

vi.mock('../../../../src/config/database', () => ({
  obtenerBaseDatos: obtenerBaseDatosMock,
}));

vi.mock('../../../../src/middlewares/authenticate', () => ({
  authenticate: authenticateMock,
}));

vi.mock('../../../../src/modules/configuracion-institucional/configuracion-institucional.repository', () => ({
  ConfiguracionInstitucionalRepository: class {
    constructor(bd: unknown) {
      configurarRepositoryConstructorMock(bd);
    }

    obtener(empresaId: number): Promise<ConfiguracionInstitucionalPrueba | null> {
      return obtenerConfiguracionMock(empresaId);
    }
  },
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.periodos.repository', () => ({
  PeriodosRepository: class {
    constructor(bd: unknown) {
      periodosRepositoryConstructorMock(bd);
    }
  },
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.periodos.service', () => ({
  PeriodosService: class {
    constructor(dependencias: DependenciasPeriodosPrueba) {
      periodosServiceConstructorMock(dependencias);
    }

    asegurar(empresaId: number, usuarioId: number, hoy: Date): Promise<void> {
      return asegurarPeriodosMock(empresaId, usuarioId, hoy);
    }
  },
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.repository', () => ({
  VacacionesRepository: class {
    constructor(bd: unknown) {
      vacacionesRepositoryConstructorMock(bd);
    }
  },
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.service', () => ({
  VacacionesService: class {
    constructor(dependencias: DependenciasVacacionesPrueba) {
      vacacionesServiceConstructorMock(dependencias);
      return servicioMock;
    }
  },
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.controller', () => ({
  crearVacacionesController: controllerFactoryMock,
}));

vi.mock('../../../../src/modules/vacaciones/vacaciones.routes', () => ({
  crearVacacionesRouter: routerFactoryMock,
}));

import { obtenerBaseDatos } from '../../../../src/config/database';
import { authenticate } from '../../../../src/middlewares/authenticate';
import { AppError } from '../../../../src/shared/errors/AppError';
import {
  crearModuloVacaciones,
  crearRouterVacaciones,
} from '../../../../src/modules/vacaciones/vacaciones.modulo';

describe('ModuloVacaciones', () => {
  const configuracion = {
    plazoHoras: 48,
    diasVacacionesAnuales: 30,
    zonaHoraria: 'America/Guayaquil',
    diasAnticipacionVacaciones: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    obtenerBaseDatosMock.mockReturnValue(baseDatosMock);
    obtenerConfiguracionMock.mockResolvedValue(configuracion);
    asegurarPeriodosMock.mockResolvedValue(undefined);
    controllerFactoryMock.mockReturnValue(controllerMock);
    routerFactoryMock.mockReturnValue(middlewareMock);
  });

  it('construye el módulo conectando la base de datos y sus repositorios', () => {
    const modulo = crearModuloVacaciones();

    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(obtenerBaseDatos).toHaveReturnedWith(baseDatosMock);
    expect(configurarRepositoryConstructorMock).toHaveBeenCalledWith(baseDatosMock);
    expect(periodosRepositoryConstructorMock).toHaveBeenCalledWith(baseDatosMock);
    expect(vacacionesRepositoryConstructorMock).toHaveBeenCalledWith(baseDatosMock);
    expect(vacacionesServiceConstructorMock).toHaveBeenCalledOnce();
    expect(modulo.servicio).toBe(servicioMock);
    expect(modulo.router).toBeDefined();
    expect(typeof modulo.router).toBe('function');
  });

  it('obtiene los días anuales institucionales para asegurar los periodos', async () => {
    crearModuloVacaciones();

    const dependencias = periodosServiceConstructorMock.mock.calls[0]?.[0];

if (!dependencias) {
  throw new Error('No se construyeron las dependencias de PeriodosService');
}

    await expect(dependencias.obtenerDiasVacacionesAnuales(7)).resolves.toBe(30);
    expect(obtenerConfiguracionMock).toHaveBeenCalledWith(7);
  });

  it('rechaza asegurar periodos cuando no existe configuración institucional', async () => {
    obtenerConfiguracionMock.mockResolvedValue(null);

    crearModuloVacaciones();

    const dependencias = periodosServiceConstructorMock.mock.calls[0]?.[0];

if (!dependencias) {
  throw new Error('No se construyeron las dependencias de PeriodosService');
}

    await expect(dependencias.obtenerDiasVacacionesAnuales(7)).rejects.toThrow(
      AppError,
    );
    await expect(dependencias.obtenerDiasVacacionesAnuales(7)).rejects.toThrow(
      'No existe configuración institucional para el hospital 7',
    );

    expect(obtenerConfiguracionMock).toHaveBeenCalledTimes(2);
  });

  it('entrega al servicio las reglas institucionales vigentes', async () => {
    crearModuloVacaciones();

    const dependencias = vacacionesServiceConstructorMock.mock.calls[0]?.[0];

if (!dependencias) {
  throw new Error('No se construyeron las dependencias de VacacionesService');
}

    await expect(
      dependencias.obtenerConfiguracionInstitucional(7),
    ).resolves.toEqual(configuracion);
    expect(obtenerConfiguracionMock).toHaveBeenCalledWith(7);
  });

  it('devuelve null al servicio cuando no existe configuración institucional', async () => {
    obtenerConfiguracionMock.mockResolvedValueOnce(null);

    crearModuloVacaciones();

    const dependencias = vacacionesServiceConstructorMock.mock.calls[0]?.[0];

if (!dependencias) {
  throw new Error('No se construyeron las dependencias de VacacionesService');
}

    await expect(
      dependencias.obtenerConfiguracionInstitucional(7),
    ).resolves.toBeNull();
  });

  it('conecta el cálculo de días laborables y el aseguramiento de periodos', async () => {
    const modulo = crearModuloVacaciones();
    const dependencias = vacacionesServiceConstructorMock.mock.calls[0]?.[0];

if (!dependencias) {
  throw new Error('No se construyeron las dependencias de VacacionesService');
}
    const hoy = new Date('2026-11-04T12:00:00.000Z');

    expect(dependencias.calcularDiasLaborables).toBeTypeOf('function');

    await dependencias.asegurarPeriodos(7, 12, hoy);

    expect(asegurarPeriodosMock).toHaveBeenCalledWith(7, 12, hoy);
    expect(modulo.servicio).toBe(servicioMock);
  });

  it('monta el router con el controlador y el middleware de autenticación', () => {
    const modulo = crearModuloVacaciones();

    expect(controllerFactoryMock).toHaveBeenCalledWith(servicioMock);
    expect(routerFactoryMock).toHaveBeenCalledWith({
      controller: controllerMock,
      autenticar: authenticate,
    });
    expect(authenticate).toBe(authenticateMock);
    expect(modulo.router).toBeDefined();
  });

  it('crea un router independiente mediante crearRouterVacaciones', () => {
    const router = crearRouterVacaciones();

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(obtenerBaseDatos).toHaveBeenCalledOnce();
    expect(routerFactoryMock).toHaveBeenCalledOnce();
  });
});