// Endpoints de usuarios y los roles que pueden usarlos. Sin logica.
// El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authorizeRole } from '../../middlewares/authorizeRole';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { esquemaId } from '../../shared/validators/comunes';
import type { UsuariosController } from './usuarios.controller';
import {
  esquemaActualizarUsuario,
  esquemaBaja,
  esquemaCrearUsuario,
  esquemaFiltrosUsuarios,
} from './usuarios.validators';

export interface DependenciasRouterUsuarios {
  controller: UsuariosController;
  // authenticate real en la aplicacion; el mismo con dobles en las pruebas
  autenticar: RequestHandler;
}

export function crearUsuariosRouter(deps: DependenciasRouterUsuarios): Router {
  const router = Router();
  const c = deps.controller;

  // Todo el modulo exige sesion, filtra por el hospital del token y es de Talento Humano y el administrador
  router.use(deps.autenticar, multitenant, authorizeRole('SUPERADMIN', 'TALENTO_HUMANO'));

  router.get('/', validate({ query: esquemaFiltrosUsuarios }), c.listar);
  router.post('/', validate({ body: esquemaCrearUsuario }), c.crear);
  router.get('/:id', validate({ params: esquemaId }), c.obtener);
  router.patch(
    '/:id',
    validate({ params: esquemaId, body: esquemaActualizarUsuario }),
    c.actualizar,
  );
  router.post('/:id/baja', validate({ params: esquemaId, body: esquemaBaja }), c.darDeBaja);
  router.post('/:id/reactivar', validate({ params: esquemaId }), c.reactivar);

  return router;
}