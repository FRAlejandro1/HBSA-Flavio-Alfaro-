// Rutas de configuracion institucional.
// Restringe la administracion a SUPERADMIN y aplica aislamiento por hospital.

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { multitenant } from '../../middlewares/multitenant';
import { authorizeRole } from '../../middlewares/authorizeRole';
import { validate } from '../../middlewares/validate';
import type { ConfiguracionInstitucionalController } from './configuracion-institucional.controller';
import { esquemaActualizarConfiguracionInstitucional } from './configuracion-institucional.validators';

export interface DependenciasRouterConfiguracionInstitucional {
  controller: ConfiguracionInstitucionalController;
  autenticar: RequestHandler;
}

export function crearConfiguracionInstitucionalRouter(
  deps: DependenciasRouterConfiguracionInstitucional,
): Router {
  const router = Router();
  const c = deps.controller;

  // Todas las operaciones requieren autenticacion, aislamiento y rol SUPERADMIN.
  router.use(
    deps.autenticar,
    multitenant,
    authorizeRole('SUPERADMIN'),
  );

  router.get('/', c.obtener);

  router.put(
    '/',
    validate({ body: esquemaActualizarConfiguracionInstitucional }),
    c.actualizar,
  );

  return router;
}