// Endpoints de la importacion de personal. Reciben un archivo (multipart) con tope de tamano y lo dejan en memoria;
// los errores de multer se traducen al formato de errores de la API. Sin logica.
import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer, { MulterError } from 'multer';
import { authorizeRole } from '../../middlewares/authorizeRole';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { csrf } from '../../middlewares/csrf';
import { AppError } from '../../shared/errors/AppError';
import type { ImportacionController } from './importacion.controller';
import { esquemaAplicacion, esquemaRevision } from './importacion.validators';
import { LIMITES_ARCHIVO } from './lectores/tipos';

export interface DependenciasRouterImportacion {
  controller: ImportacionController;
  // authenticate real en la aplicacion; el mismo con dobles en las pruebas
  autenticar: RequestHandler;
}

const MENSAJES_MULTER: Record<string, string> = {
  LIMIT_FILE_SIZE: 'El archivo supera los 5 MB',
  LIMIT_UNEXPECTED_FILE: 'Solo se admite un archivo, en el campo "archivo"',
  LIMIT_FILE_COUNT: 'Solo se admite un archivo',
  LIMIT_FIELD_COUNT: 'El formulario tiene demasiados campos',
  LIMIT_FIELD_VALUE: 'Un campo del formulario es demasiado largo',
};

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITES_ARCHIVO.bytes, files: 1, fields: 5, fieldSize: 8 * 1024 },
}).single('archivo');

function recibirArchivo(req: Request, res: Response, next: NextFunction): void {
  subida(req, res, (error: unknown) => {
    if (error === undefined || error === null) {
      next();
    } else if (error instanceof MulterError) {
      next(AppError.validacion(MENSAJES_MULTER[error.code] ?? 'No se pudo recibir el archivo'));
    } else {
      next(error);
    }
  });
}

export function crearImportacionRouter(deps: DependenciasRouterImportacion): Router {
  const router = Router();
  const c = deps.controller;

  // Solo el administrador y Talento Humano, siempre sobre el hospital del token
router.use(deps.autenticar, csrf, multitenant, authorizeRole('SUPERADMIN', 'TALENTO_HUMANO'));

  router.post('/personal/revisar', recibirArchivo, validate({ body: esquemaRevision }), c.revisar);
  router.post('/personal/aplicar', recibirArchivo, validate({ body: esquemaAplicacion }), c.aplicar);

  return router;
}