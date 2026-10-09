// Endpoints de organizacion y los roles que pueden usar cada uno. Sin logica.
// El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authorizeRole } from '../../middlewares/authorizeRole';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import type { OrganizacionController } from './organizacion.controller';
import {
  esquemaActualizarArea,
  esquemaActualizarCargo,
  esquemaCrearArea,
  esquemaCrearCargo,
  esquemaId,
} from './organizacion.validators';

export interface DependenciasRouterOrganizacion {
  controller: OrganizacionController;
  // authenticate real en la aplicacion; el mismo con dobles en las pruebas
  autenticar: RequestHandler;
}

export function crearOrganizacionRouter(deps: DependenciasRouterOrganizacion): Router {
  const router = Router();
  const c = deps.controller;

  // Todo el modulo exige sesion y filtra por el hospital del token
  router.use(deps.autenticar, multitenant);

  // Las areas solo las administra el SUPERADMIN; los cargos tambien Talento Humano
  const administraAreas = authorizeRole('SUPERADMIN');
  const administraCargos = authorizeRole('SUPERADMIN', 'TALENTO_HUMANO');

  // Lectura: cualquier rol autenticado (los formularios necesitan los catalogos)
  router.get('/areas', c.listarAreas);
  router.get('/cargos', c.listarCargos);

  router.post('/areas', administraAreas, validate({ body: esquemaCrearArea }), c.crearArea);
  router.patch(
    '/areas/:id',
    administraAreas,
    validate({ params: esquemaId, body: esquemaActualizarArea }),
    c.actualizarArea,
  );
  router.delete('/areas/:id', administraAreas, validate({ params: esquemaId }), c.eliminarArea);

  router.post('/cargos', administraCargos, validate({ body: esquemaCrearCargo }), c.crearCargo);
  router.patch(
    '/cargos/:id',
    administraCargos,
    validate({ params: esquemaId, body: esquemaActualizarCargo }),
    c.actualizarCargo,
  );
  router.delete('/cargos/:id', administraCargos, validate({ params: esquemaId }), c.eliminarCargo);

  return router;
}