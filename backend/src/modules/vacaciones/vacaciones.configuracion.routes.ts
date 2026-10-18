// Endpoints de configuracion de dias de vacaciones: solo el SUPERADMIN. Sin logica.
// El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authorizeRole } from '../../middlewares/authorizeRole';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { esquemaId } from '../../shared/validators/comunes';
import type { ConfiguracionVacacionesController } from './vacaciones.configuracion.controller';
import { esquemaDiasVacaciones } from './vacaciones.configuracion.validators';

export interface DependenciasRouterConfiguracionVacaciones {
  controller: ConfiguracionVacacionesController;
  // authenticate real en la aplicacion; el mismo con dobles en las pruebas
  autenticar: RequestHandler;
}

export function crearConfiguracionVacacionesRouter(deps: DependenciasRouterConfiguracionVacaciones): Router {
  const router = Router();
  const c = deps.controller;

  // Todo el modulo exige sesion, filtra por el hospital del token y es solo del SUPERADMIN
  router.use(deps.autenticar, multitenant, authorizeRole('SUPERADMIN'));

  router.get('/areas/:id/dias', validate({ params: esquemaId }), c.obtenerDiasDeArea);
  router.put(
    '/areas/:id/dias',
    validate({ params: esquemaId, body: esquemaDiasVacaciones }),
    c.fijarDiasDeArea,
  );
  router.get('/usuarios/:id/dias', validate({ params: esquemaId }), c.obtenerDiasDePersona);
  router.put(
    '/usuarios/:id/dias',
    validate({ params: esquemaId, body: esquemaDiasVacaciones }),
    c.fijarDiasDePersona,
  );

  return router;
}