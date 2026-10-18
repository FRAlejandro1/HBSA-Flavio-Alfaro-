// Endpoints de vacaciones y quien puede usar cada uno. Sin logica.
// El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { esquemaId } from '../../shared/validators/comunes';
import type { VacacionesController } from './vacaciones.controller';
import {
  esquemaCrearSolicitud,
  esquemaDecision,
  esquemaFiltrosSolicitudes,
} from './vacaciones.validators';

export interface DependenciasRouterVacaciones {
  controller: VacacionesController;
  // authenticate real en la aplicacion; el mismo con dobles en las pruebas
  autenticar: RequestHandler;
}

export function crearVacacionesRouter(deps: DependenciasRouterVacaciones): Router {
  const router = Router();
  const c = deps.controller;

  // Todo el modulo exige sesion y filtra por el hospital del token
  router.use(deps.autenticar, multitenant);

  // Cualquier rol autenticado solicita y consulta lo suyo; quien puede ver cada solicitud lo decide el service
  router.post('/solicitudes', validate({ body: esquemaCrearSolicitud }), c.crearSolicitud);
  router.get('/solicitudes', validate({ query: esquemaFiltrosSolicitudes }), c.listarMisSolicitudes);
  router.get('/solicitudes/:id', validate({ params: esquemaId }), c.obtenerSolicitud);

  // Decidir lo hace quien tiene asignado el paso pendiente (no un rol) y cancelar solo quien la solicito: lo decide el service
  router.post(
    '/solicitudes/:id/aprobar',
    validate({ params: esquemaId, body: esquemaDecision }),
    c.aprobarSolicitud,
  );
  router.post(
    '/solicitudes/:id/negar',
    validate({ params: esquemaId, body: esquemaDecision }),
    c.negarSolicitud,
  );
  router.post(
    '/solicitudes/:id/cancelar',
    validate({ params: esquemaId, body: esquemaDecision }),
    c.cancelarSolicitud,
  );

  return router;
}