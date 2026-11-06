// Rutas HTTP de delegaciones institucionales.
// Exige autenticacion, aislamiento por hospital y validacion de entradas.

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { esquemaId } from '../../shared/validators/comunes';
import type { DelegacionesController } from './delegaciones.controller';
import {
  esquemaCrearDelegacion,
  esquemaFiltrosDelegaciones,
} from './delegaciones.validators';

export interface DependenciasRouterDelegaciones {
  controller: DelegacionesController;
  autenticar: RequestHandler;
}

export function crearDelegacionesRouter(
  deps: DependenciasRouterDelegaciones,
): Router {
  const router = Router();
  const c = deps.controller;

  router.use(deps.autenticar, multitenant);

  router.get(
    '/',
    validate({ query: esquemaFiltrosDelegaciones }),
    c.listar,
  );

  router.post(
    '/',
    validate({ body: esquemaCrearDelegacion }),
    c.crear,
  );

  router.get(
    '/:id',
    validate({ params: esquemaId }),
    c.obtener,
  );

  router.post(
    '/:id/revocar',
    validate({ params: esquemaId }),
    c.revocar,
  );

  return router;
}