// Composicion del modulo de delegaciones.
// Conecta la base de datos, el repositorio, el servicio y las rutas HTTP.

import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { authenticate } from '../../middlewares/authenticate';
import { crearDelegacionesController } from './delegaciones.controller';
import { DelegacionesRepository } from './delegaciones.repository';
import { crearDelegacionesRouter } from './delegaciones.routes';
import { DelegacionesService } from './delegaciones.service';

export function crearRouterDelegaciones(): Router {
  const servicio = new DelegacionesService({
    repositorio: new DelegacionesRepository(obtenerBaseDatos()),
  });

  return crearDelegacionesRouter({
    controller: crearDelegacionesController(servicio),
    autenticar: authenticate,
  });
}