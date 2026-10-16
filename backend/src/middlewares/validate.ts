// Aplica esquemas Zod a body, query y params. Si algo no cumple, Zod lanza un error que
// errorHandler convierte en 400 con el detalle por campo. Si cumple, deja en la peticion los valores
// ya limpios y convertidos (recortados, numeros reales, valores por defecto).
import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface EsquemasPeticion {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(esquemas: EsquemasPeticion): RequestHandler {
  return (req, _res, next) => {
    if (esquemas.body) {
      const cuerpo: unknown = esquemas.body.parse(req.body);
      req.body = cuerpo;
    }

    if (esquemas.query) {
      const consulta: unknown = esquemas.query.parse(req.query);
      // En Express 5 req.query solo tiene lectura: se redefine como propiedad propia
      Object.defineProperty(req, 'query', {
        value: consulta,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (esquemas.params) {
      const parametros: unknown = esquemas.params.parse(req.params);
      req.params = parametros as Request['params'];
    }

    next();
  };
}