// Define los endpoints de autenticacion y encadena sus middlewares. Sin logica.
// El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../../middlewares/validate';
import type { AuthController } from './auth.controller';
import { esquemaLogin } from './auth.validators';

export interface DependenciasRouterAuth {
  controller: AuthController;
  // authenticate real en la aplicacion; un doble en las pruebas
  autenticar: RequestHandler;
  // Limite estricto para login y refresh
  limitadorAutenticacion: RequestHandler;
}

export function crearAuthRouter(deps: DependenciasRouterAuth): Router {
  const router = Router();

  // Ninguna respuesta de autenticacion debe quedar en cache del navegador ni de un proxy
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/csrf', deps.controller.obtenerCsrf);
  router.post(
    '/login',
    deps.limitadorAutenticacion,
    validate({ body: esquemaLogin }),
    deps.controller.login,
  );
  router.post('/refresh', deps.limitadorAutenticacion, deps.controller.refresh);
  router.post('/logout', deps.autenticar, deps.controller.logout);
  router.get('/me', deps.autenticar, deps.controller.me);

  return router;
}