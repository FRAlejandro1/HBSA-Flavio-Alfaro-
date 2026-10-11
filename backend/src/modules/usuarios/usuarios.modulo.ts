// Composicion del modulo: conecta la base de datos y Argon2 reales y devuelve el router para app.ts.
import type { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { env } from '../../config/env';
import { authenticate } from '../../middlewares/authenticate';
import { hashearClave } from '../../shared/security/password';
import { hoyEnZona } from '../../shared/utils/zonaHoraria';
import { crearUsuariosController } from './usuarios.controller';
import { UsuariosRepository } from './usuarios.repository';
import { crearUsuariosRouter } from './usuarios.routes';
import { UsuariosService } from './usuarios.service';

export function crearRouterUsuarios(): Router {
  const servicio = new UsuariosService({
    repositorio: new UsuariosRepository(obtenerBaseDatos()),
    hashear: hashearClave,
    hoy: () => hoyEnZona(env.ZONA_HORARIA_NEGOCIO),
  });
  return crearUsuariosRouter({
    controller: crearUsuariosController(servicio),
    autenticar: authenticate,
  });
}