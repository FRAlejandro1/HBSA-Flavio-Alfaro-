// Traduce HTTP a llamadas del service. El hospital sale del token y el archivo llega en memoria (multer).
// Sin reglas de negocio.
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { exigirUsuario } from '../../shared/http/peticion';
import type { ArchivoSubido } from './lectores/tipos';
import type { ImportacionService } from './importacion.service';
import type { AplicacionEntrada, RevisionEntrada } from './importacion.validators';

export interface ImportacionController {
  revisar: RequestHandler;
  aplicar: RequestHandler;
}

// El navegador envia el nombre en UTF-8 pero el formulario lo entrega leido como Latin-1
function exigirArchivo(req: Request): ArchivoSubido {
  if (req.file === undefined) {
    throw AppError.validacion('Falta el archivo (campo "archivo")');
  }
  const nombre = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 150);
  return { nombre, contenido: req.file.buffer };
}

export function crearImportacionController(servicio: ImportacionService): ImportacionController {
  return {
    revisar: async (req, res) => {
      const { mapeo, bajaAusentes } = req.body as RevisionEntrada;
      const revision = await servicio.revisar(exigirUsuario(req), exigirArchivo(req), { mapeo, bajaAusentes });
      res.json({ revision });
    },

    aplicar: async (req, res) => {
      const { mapeo, bajaAusentes, huella } = req.body as AplicacionEntrada;
      const resultado = await servicio.aplicar(
        exigirUsuario(req),
        exigirArchivo(req),
        { mapeo, bajaAusentes },
        huella,
      );
      res.json({ resultado });
    },
  };
}