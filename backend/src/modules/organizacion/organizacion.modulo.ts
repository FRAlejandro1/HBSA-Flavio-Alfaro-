// Composicion del modulo: conecta la base de datos real y devuelve el router listo para montar en app.ts.
import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { authenticate } from '../../middlewares/authenticate';
import { crearOrganizacionController } from './organizacion.controller';
import { OrganizacionRepository } from './organizacion.repository';
import { crearOrganizacionRouter } from './organizacion.routes';
import { OrganizacionService } from './organizacion.service';

export function crearRouterOrganizacion(): Router {
  const servicio = new OrganizacionService(new OrganizacionRepository(obtenerBaseDatos()));
  return crearOrganizacionRouter({
    controller: crearOrganizacionController(servicio),
    autenticar: authenticate,
  });
}