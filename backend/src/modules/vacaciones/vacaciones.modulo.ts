
 // Composición del módulo: conecta la base de datos real y devuelve el router junto con el servicio.
// Agrupa las solicitudes de vacaciones y la configuración de días, exclusiva de SUPERADMIN.
import { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { env } from '../../config/env';
import { authenticate } from '../../middlewares/authenticate';
import { calcularDiasLaborables } from '../../shared/utils/fechas';
import { crearConfiguracionVacacionesController } from './vacaciones.configuracion.controller';
import { crearConfiguracionVacacionesRouter } from './vacaciones.configuracion.routes';
import { crearVacacionesController } from './vacaciones.controller';
import { PeriodosRepository } from './vacaciones.periodos.repository';
import { PeriodosService } from './vacaciones.periodos.service';
import { VacacionesRepository } from './vacaciones.repository';
import { crearVacacionesRouter } from './vacaciones.routes';
import { VacacionesService } from './vacaciones.service';

export interface ModuloVacaciones {
  router: Router;
  servicio: VacacionesService;
}

export function crearModuloVacaciones(): ModuloVacaciones {
  const bd = obtenerBaseDatos();

  const periodos = new PeriodosService({
    repositorio: new PeriodosRepository(bd),
    diasPorDefecto: env.DIAS_VACACIONES_ANUALES,
  });

  const servicio = new VacacionesService({
    repositorio: new VacacionesRepository(bd),
    calcularDiasLaborables,
    plazoAprobacionHoras: env.PLAZO_APROBACION_HORAS,
    asegurarPeriodos: (empresaId, usuarioId, hoy) =>
      periodos.asegurar(empresaId, usuarioId, hoy),
    zonaHoraria: env.ZONA_HORARIA_NEGOCIO,
  });

  const router = Router();

  // La configuración se monta primero y aplica la autenticación requerida en sus rutas.
  router.use(
    '/configuracion',
    crearConfiguracionVacacionesRouter({
      controller: crearConfiguracionVacacionesController(periodos),
      autenticar: authenticate,
    }),
  );

  router.use(
    crearVacacionesRouter({
      controller: crearVacacionesController(servicio),
      autenticar: authenticate,
    }),
  );

  return { router, servicio };
}

export function crearRouterVacaciones(): Router {
  return crearModuloVacaciones().router;
}
