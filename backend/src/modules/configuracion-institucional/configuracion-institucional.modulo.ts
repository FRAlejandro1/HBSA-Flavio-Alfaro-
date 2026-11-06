// Composicion del modulo de configuracion institucional.
// Conecta persistencia, servicio, controlador y rutas protegidas para SUPERADMIN.

import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { authenticate } from '../../middlewares/authenticate';
import { crearConfiguracionInstitucionalController } from './configuracion-institucional.controller';
import { ConfiguracionInstitucionalRepository } from './configuracion-institucional.repository';
import { crearConfiguracionInstitucionalRouter } from './configuracion-institucional.routes';
import { ConfiguracionInstitucionalService } from './configuracion-institucional.service';

export interface ModuloConfiguracionInstitucional {
  router: Router;
  servicio: ConfiguracionInstitucionalService;
}

export function crearModuloConfiguracionInstitucional(): ModuloConfiguracionInstitucional {
  const bd = obtenerBaseDatos();

  const servicio = new ConfiguracionInstitucionalService({
    repositorio: new ConfiguracionInstitucionalRepository(bd),
  });

  const router = crearConfiguracionInstitucionalRouter({
    controller: crearConfiguracionInstitucionalController(servicio),
    autenticar: authenticate,
  });

  return { router, servicio };
}

// Expone el router para integrarlo en el montaje central de la API.
export function crearRouterConfiguracionInstitucional(): Router {
  return crearModuloConfiguracionInstitucional().router;
}