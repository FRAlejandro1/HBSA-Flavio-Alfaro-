// Respuesta uniforme de errores: traduce AppError, errores de Zod y JSON invalido a
// { codigo, mensaje, detalles? }. Cualquier otro error responde 500 sin filtrar datos internos.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../shared/errors/AppError';

// Forma del cuerpo de toda respuesta de error de la API
interface CuerpoError {
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

interface ErrorHttp {
  estado: number;
  cuerpo: CuerpoError;
}

// Detecta el error que lanza express.json() ante un cuerpo mal formado
function esJsonInvalido(error: unknown): boolean {
  return error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
}

// Convierte cualquier error en estado HTTP y cuerpo seguro para el cliente
function aErrorHttp(error: unknown): ErrorHttp {
  if (error instanceof AppError) {
    const cuerpo: CuerpoError = { codigo: error.codigo, mensaje: error.message };
    if (error.detalles !== undefined) {
      cuerpo.detalles = error.detalles;
    }
    return { estado: error.estado, cuerpo };
  }

  if (error instanceof ZodError) {
    return {
      estado: 400,
      cuerpo: {
        codigo: 'VALIDACION',
        mensaje: 'Los datos enviados no son validos',
        detalles: error.issues.map((problema) => ({
          campo: problema.path.join('.'),
          mensaje: problema.message,
        })),
      },
    };
  }

  if (esJsonInvalido(error)) {
    return {
      estado: 400,
      cuerpo: { codigo: 'VALIDACION', mensaje: 'El cuerpo de la peticion no es JSON valido' },
    };
  }

  return {
    estado: 500,
    cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrio un error inesperado' },
  };
}

// Ultimo middleware de la cadena: registra el error y responde
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  // Si ya se envio parte de la respuesta, Express debe cerrar la conexion
  if (res.headersSent) {
    next(error);
    return;
  }

  const { estado, cuerpo } = aErrorHttp(error);
  const contexto = { metodo: req.method, ruta: req.originalUrl, estado, codigo: cuerpo.codigo };

  if (estado >= 500) {
    logger.error('Error no controlado', {
      ...contexto,
      detalle: error instanceof Error ? error.stack : String(error),
    });
  } else {
    logger.warn('Peticion rechazada', { ...contexto, mensaje: cuerpo.mensaje });
  }

  res.status(estado).json(cuerpo);
};

// Se monta despues de todas las rutas: cualquier ruta sin dueno termina en 404
export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(AppError.noEncontrado(`La ruta ${req.method} ${req.path} no existe`));
};