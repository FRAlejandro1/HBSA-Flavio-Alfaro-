// Composicion del modulo: conecta la base de datos real y devuelve el router listo para montar en app.ts.
import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { env } from '../../config/env';
import { authenticate } from '../../middlewares/authenticate';
import { hoyEnZona } from '../../shared/utils/zonaHoraria';
import { crearImportacionController } from './importacion.controller';
import { ImportacionRepository } from './importacion.repository';
import { crearImportacionRouter } from './importacion.routes';
import { ImportacionService } from './importacion.service';
import { leerTabla } from './lectores';

export function crearRouterImportacion(): Router {
  const servicio = new ImportacionService({
    repositorio: new ImportacionRepository(obtenerBaseDatos()),
    leerTabla,
    hoy: () => hoyEnZona(env.ZONA_HORARIA_NEGOCIO),
  });
  return crearImportacionRouter({
    controller: crearImportacionController(servicio),
    autenticar: authenticate,
  });
}