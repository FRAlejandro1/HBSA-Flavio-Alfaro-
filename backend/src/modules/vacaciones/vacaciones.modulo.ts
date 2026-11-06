
// Composición del módulo de vacaciones: conecta la base de datos,
// la configuración institucional, los periodos y las solicitudes.
import { Router } from 'express';
import { obtenerBaseDatos } from '../../config/database';
import { authenticate } from '../../middlewares/authenticate';
import { calcularDiasLaborables } from '../../shared/utils/fechas';
import { AppError } from '../../shared/errors/AppError';
import { ConfiguracionInstitucionalRepository } from '../configuracion-institucional/configuracion-institucional.repository';
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

  // Comparte el acceso a la configuración institucional sin depender de su módulo HTTP.
  const configuracionInstitucional = new ConfiguracionInstitucionalRepository(bd);

  // Los periodos utilizan exclusivamente los días anuales configurados para el hospital.
  const periodos = new PeriodosService({
    repositorio: new PeriodosRepository(bd),
    obtenerDiasVacacionesAnuales: async (empresaId) => {
      const configuracion = await configuracionInstitucional.obtener(empresaId);

      if (configuracion === null) {
        throw AppError.reglaDeNegocio(
          `No existe configuración institucional para el hospital ${String(empresaId)}`,
        );
      }

      return configuracion.diasVacacionesAnuales;
    },
  });

  // El servicio obtiene las reglas vigentes por hospital para cada nueva operación.
  const servicio = new VacacionesService({
    repositorio: new VacacionesRepository(bd),
    obtenerConfiguracionInstitucional: async (empresaId) => {
      const configuracion = await configuracionInstitucional.obtener(empresaId);

      if (configuracion === null) {
        return null;
      }

      return {
        plazoHoras: configuracion.plazoHoras,
        diasVacacionesAnuales: configuracion.diasVacacionesAnuales,
        zonaHoraria: configuracion.zonaHoraria,
        diasAnticipacionVacaciones: configuracion.diasAnticipacionVacaciones,
      };
    },
    calcularDiasLaborables,
    asegurarPeriodos: (empresaId, usuarioId, hoy) =>
      periodos.asegurar(empresaId, usuarioId, hoy),
  });

  const router = Router();

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
