// Composición del módulo de jornadas.
// Conecta la base de datos, el servicio, el controlador y las rutas autenticadas.

import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { authenticate } from '../../middlewares/authenticate';
import { crearJornadasController } from './jornadas.controller';
import { JornadasRepository } from './jornadas.repository';
import { crearJornadasRouter } from './jornadas.routes';
import { JornadasService } from './jornadas.service';

export interface ModuloJornadas {
  router: Router;
  servicio: JornadasService;
}

export function crearModuloJornadas(): ModuloJornadas {
  const bd = obtenerBaseDatos();
  const servicio = new JornadasService({
    repositorio: new JornadasRepository(bd),
  });

  const router = crearJornadasRouter({
    controller: crearJornadasController(servicio),
    autenticar: authenticate,
  });

  return { router, servicio };
}

// Expone el router para integrarlo en el montaje central de la API.
export function crearRouterJornadas(): Router {
  return crearModuloJornadas().router;
}
