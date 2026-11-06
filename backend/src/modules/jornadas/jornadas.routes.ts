// Endpoints de jornadas y autenticación requerida.
// La empresa y el actor se obtienen del token mediante los middlewares compartidos.

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { multitenant } from '../../middlewares/multitenant';
import { validate } from '../../middlewares/validate';
import { esquemaId } from '../../shared/validators/comunes';
import type { JornadasController } from './jornadas.controller';
import {
  esquemaActualizarTurno,
  esquemaCerrarAsignacion,
  esquemaConsultarJornada,
  esquemaCrearAsignacion,
  esquemaCrearPatron,
  esquemaCrearTurno,
  esquemaListarJornadas,
} from './jornadas.validators';

export interface DependenciasRouterJornadas {
  controller: JornadasController;
  autenticar: RequestHandler;
}

export function crearJornadasRouter(
  deps: DependenciasRouterJornadas,
): Router {
  const router = Router();
  const c = deps.controller;

  // Todo el módulo exige sesión y aislamiento por hospital.
  router.use(deps.autenticar, multitenant);

  // Turnos.
  router.get(
    '/turnos',
    validate({ query: esquemaListarJornadas }),
    c.listarTurnos,
  );
  router.get('/turnos/:id', validate({ params: esquemaId }), c.obtenerTurno);
  router.post(
    '/turnos',
    validate({ body: esquemaCrearTurno }),
    c.crearTurno,
  );
  router.put(
    '/turnos/:id',
    validate({ params: esquemaId, body: esquemaActualizarTurno }),
    c.actualizarTurno,
  );

  // Patrones rotativos.
  router.get(
    '/patrones',
    validate({ query: esquemaListarJornadas }),
    c.listarPatrones,
  );
  router.get('/patrones/:id', validate({ params: esquemaId }), c.obtenerPatron);
  router.post(
    '/patrones',
    validate({ body: esquemaCrearPatron }),
    c.crearPatron,
  );

  // Asignaciones históricas y consulta de jornada por fecha.
  router.post(
    '/asignaciones',
    validate({ body: esquemaCrearAsignacion }),
    c.crearAsignacion,
  );
  router.post(
    '/asignaciones/cerrar',
    validate({ body: esquemaCerrarAsignacion }),
    c.cerrarAsignacion,
  );
  router.get(
    '/consulta',
    validate({ query: esquemaConsultarJornada }),
    c.consultarJornada,
  );

  return router;
}
