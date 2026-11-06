// Pruebas unitarias de las rutas de importación.
// Verifica el tratamiento de códigos Multer no contemplados.

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { multerMock, MulterErrorMock, configurarErrorMulter } = vi.hoisted(() => {
  class MulterErrorMock extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.name = 'MulterError';
      this.code = code;
    }
  }

  let errorConfigurado: unknown = new MulterErrorMock('UNKNOWN_CODE');

  const middleware = (
    _req: unknown,
    _res: unknown,
    callback: (error?: unknown) => void,
  ) => {
    callback(errorConfigurado);
  };

  const single = vi.fn(() => middleware);

  return {
    multerMock: Object.assign(
      vi.fn(() => ({
        single,
      })),
      {
        memoryStorage: vi.fn(() => ({})),
      },
    ),
    MulterErrorMock,
    configurarErrorMulter: (error: unknown) => {
      errorConfigurado = error;
    },
  };
});

vi.mock('multer', () => ({
  default: multerMock,
  MulterError: MulterErrorMock,
}));

vi.mock('../../../../src/middlewares/csrf', () => ({
  csrf: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../../src/middlewares/multitenant', () => ({
  multitenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../../src/middlewares/authorizeRole', () => ({
  authorizeRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { crearImportacionRouter } from '../../../../src/modules/importacion/importacion.routes';
import type { ImportacionController } from '../../../../src/modules/importacion/importacion.controller';
import { errorHandler } from '../../../../src/middlewares/errorHandler';

describe('rutas de importación', () => {
  it('usa el mensaje genérico para un código Multer desconocido', async () => {
    const controller = {
      revisar: vi.fn(),
      aplicar: vi.fn(),
    } as unknown as ImportacionController;

    const router = crearImportacionRouter({
      controller,
      autenticar: (_req, _res, next) => next(),
    });

    const app = express();
    app.use('/api/importacion', router);
    app.use(errorHandler);

    const respuesta = await request(app)
      .post('/api/importacion/personal/revisar')
      .attach('archivo', Buffer.from('contenido'), 'personal.csv');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject({
      mensaje: 'No se pudo recibir el archivo',
    });
    expect(controller.revisar).not.toHaveBeenCalled();
  });
  it('continúa cuando Multer no devuelve error undefined', async () => {
    configurarErrorMulter(undefined);

    const controller = {
      revisar: vi.fn(),
      aplicar: vi.fn(),
    } as unknown as ImportacionController;

    const router = crearImportacionRouter({
      controller,
      autenticar: (_req, _res, next) => next(),
    });

    const app = express();
    app.use('/api/importacion', router);
    app.use(errorHandler);

    const respuesta = await request(app)
      .post('/api/importacion/personal/revisar')
      .attach('archivo', Buffer.from('contenido'), 'personal.csv');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).not.toMatchObject({
      mensaje: 'No se pudo recibir el archivo',
    });
  });

  it('continúa cuando Multer no devuelve error null', async () => {
    configurarErrorMulter(null);

    const controller = {
      revisar: vi.fn(),
      aplicar: vi.fn(),
    } as unknown as ImportacionController;

    const router = crearImportacionRouter({
      controller,
      autenticar: (_req, _res, next) => next(),
    });

    const app = express();
    app.use('/api/importacion', router);
    app.use(errorHandler);

    const respuesta = await request(app)
      .post('/api/importacion/personal/revisar')
      .attach('archivo', Buffer.from('contenido'), 'personal.csv');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).not.toMatchObject({
      mensaje: 'No se pudo recibir el archivo',
    });
  });

  it('traduce un código Multer conocido', async () => {
    configurarErrorMulter(new MulterErrorMock('LIMIT_FILE_SIZE'));

    const controller = {
      revisar: vi.fn(),
      aplicar: vi.fn(),
    } as unknown as ImportacionController;

    const router = crearImportacionRouter({
      controller,
      autenticar: (_req, _res, next) => next(),
    });

    const app = express();
    app.use('/api/importacion', router);
    app.use(errorHandler);

    const respuesta = await request(app)
      .post('/api/importacion/personal/revisar')
      .attach('archivo', Buffer.from('contenido'), 'personal.csv');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toMatchObject({
      mensaje: 'El archivo supera los 5 MB',
    });
  });

  it('propaga los errores que no son de Multer', async () => {
    configurarErrorMulter(new Error('Error interno de recepción'));

    const controller = {
      revisar: vi.fn(),
      aplicar: vi.fn(),
    } as unknown as ImportacionController;

    const router = crearImportacionRouter({
      controller,
      autenticar: (_req, _res, next) => next(),
    });

    const app = express();
    app.use('/api/importacion', router);
    app.use(errorHandler);

    const respuesta = await request(app)
      .post('/api/importacion/personal/revisar')
      .attach('archivo', Buffer.from('contenido'), 'personal.csv');

    expect(respuesta.status).toBe(500);
  });
});