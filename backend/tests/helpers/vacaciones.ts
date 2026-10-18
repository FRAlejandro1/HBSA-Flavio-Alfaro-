
/**
 * Repositorio de vacaciones en memoria para pruebas automatizadas.
 *
 * Sustituye temporalmente al repositorio de MySQL para probar el servicio
 * sin depender de una base de datos. Conserva las reglas de negocio que
 * afectan al flujo de vacaciones:
 *
 * - Numeración correlativa de trámites por empresa y año.
 * - Un único paso de aprobación pendiente por solicitud.
 * - Asignación de aprobadores activos de la misma empresa.
 * - Reserva de días mientras una solicitud permanece en trámite.
 * - Decisiones permitidas únicamente sobre pasos pendientes.
 * - Escalamiento automático de pasos cuyo plazo de aprobación venció.
 *
 * Este archivo es una implementación de prueba de IVacacionesRepository.
 * Los cambios aquí no modifican directamente la base de datos.
 */
import {
  ESTADOS_EN_TRAMITE,
  MENSAJE_PASO_RESUELTO,
} from '../../src/modules/vacaciones/vacaciones.dominio';

import type {
  DatosAprobacionIntermedia,
  DatosCancelacion,
  DatosDecision,
  DatosEscalamientoPlazo,
  DatosNuevaSolicitud,
  DatosResolucionFinal,
  FiltrosSolicitudes,
  NotificacionNueva,
  PasoAprobacion,
  PasoVencido,
  PersonaResumen,
  Solicitante,
  SolicitudDetalle,
  TipoAprobador,
  TipoNotificacion,
} from '../../src/modules/vacaciones/vacaciones.dominio';

import type { IVacacionesRepository } from '../../src/modules/vacaciones/vacaciones.repository';
import { AppError } from '../../src/shared/errors/AppError';

/* -------------------------------------------------------------------------- */
/* Tipos auxiliares utilizados en las pruebas                                 */
/* -------------------------------------------------------------------------- */

/**
 * Persona de prueba con los datos adicionales que necesita el repositorio.
 *
 * La información de empresa permite comprobar que una operación no utilice
 * personas pertenecientes a otra empresa.
 */
export interface PersonaDePrueba extends Solicitante {
  empresaId: number;
  cedula: string;
  nombres: string;
  apellidos: string;
}

/** Solicitud almacenada junto con la empresa a la que pertenece. */
interface SolicitudGuardada {
  empresaId: number;
  detalle: SolicitudDetalle;
}

/**
 * Notificación registrada durante una operación del servicio.
 *
 * Se utiliza para comprobar que las autorizaciones y negativas generen
 * el aviso correspondiente sin utilizar un servicio externo.
 */
export interface NotificacionGuardada {
  empresaId: number;
  usuarioId: number;
  tipo: TipoNotificacion;
  referenciaId: number;
  mensaje: string;
}

/* -------------------------------------------------------------------------- */
/* Utilidades para los cálculos de días laborables                            */
/* -------------------------------------------------------------------------- */

/**
 * Cuenta los días laborables entre dos fechas, incluyéndolas.
 *
 * Se consideran laborables de lunes a viernes. Los sábados, domingos y
 * feriados registrados se excluyen del resultado.
 *
 * Las fechas se procesan en UTC para evitar que la zona horaria del entorno
 * de pruebas altere el cálculo.
 */
export function contarDiasLaborablesDePrueba(
  inicio: string,
  fin: string,
  feriados: ReadonlySet<string>,
): number {
  let dias = 0;
  const cursor = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fin}T00:00:00Z`);

  while (cursor <= limite) {
    const diaSemana = cursor.getUTCDay();
    const fecha = cursor.toISOString().slice(0, 10);

    if (diaSemana !== 0 && diaSemana !== 6 && !feriados.has(fecha)) {
      dias += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/* -------------------------------------------------------------------------- */
/* Estado compartido del repositorio en memoria                               */
/* -------------------------------------------------------------------------- */

/**
 * Expone las colecciones de prueba para que los tests puedan preparar
 * escenarios y comprobar los resultados de las operaciones.
 */
export interface VacacionesEnMemoria {
  /** Implementación en memoria del contrato del repositorio de vacaciones. */
  repositorio: IVacacionesRepository;

  /** Personas disponibles en los escenarios de prueba, indexadas por ID. */
  personas: Map<number, PersonaDePrueba>;

  /** Solicitudes registradas y sus respectivos pasos de aprobación. */
  solicitudes: SolicitudGuardada[];

  /** Notificaciones producidas al resolver solicitudes. */
  notificaciones: NotificacionGuardada[];

  /** Fechas de feriados expresadas como YYYY-MM-DD. */
  feriados: Set<string>;

  /**
   * Saldo base de días de cada persona.
   *
   * Las solicitudes en trámite se restan al consultar el saldo disponible,
   * pero no se descuentan definitivamente hasta que se autoriza una solicitud.
   */
  saldos: Map<number, number>;

  /** Ruta de aprobación por nivel jerárquico, ordenada por paso. */
  rutas: Map<number, TipoAprobador[]>;

  /**
   * Configuración de los aprobadores que no se obtienen directamente
   * de los datos del solicitante.
   *
   * Los valores null representan la ausencia de un aprobador configurado.
   */
  aprobadores: {
    jefeArea: Map<number, number>;
    autoridadMaxima: number | null;
    superadmin: number | null;
  };

  /**
   * IDs de las personas que se encuentran ausentes en la fecha de prueba.
   * Un aprobador ausente puede estar activo, pero su paso no se muestra
   * como disponible para actuar.
   */
  ausentes: Set<number>;
}

/* -------------------------------------------------------------------------- */
/* Construcción del repositorio en memoria                                    */
/* -------------------------------------------------------------------------- */

/**
 * Crea un repositorio aislado para una prueba.
 *
 * Los contadores empiezan en valores conocidos para facilitar las aserciones.
 * Cada llamada crea sus propias colecciones, evitando que los datos de una
 * prueba contaminen los escenarios de otra.
 */
export function crearVacacionesEnMemoria(): VacacionesEnMemoria {
  let siguienteId = 500;
  let siguientePaso = 900;

  const personas = new Map<number, PersonaDePrueba>();
  const solicitudes: SolicitudGuardada[] = [];
  const notificaciones: NotificacionGuardada[] = [];
  const feriados = new Set<string>();
  const saldos = new Map<number, number>();
  const rutas = new Map<number, TipoAprobador[]>();

  /** Secuencia independiente para cada combinación de empresa y año. */
  const contadores = new Map<string, number>();

  /** Configuración de los responsables de aprobación. */
  const aprobadores = {
    jefeArea: new Map<number, number>(),
    autoridadMaxima: null as number | null,
    superadmin: null as number | null,
  };

  const ausentes = new Set<number>();

  /* ------------------------------------------------------------------------ */
  /* Funciones auxiliares de consulta                                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Busca una persona y comprueba que pertenezca a la empresa solicitada.
   *
   * La comprobación evita que las pruebas permitan referencias cruzadas
   * entre empresas.
   */
  const buscarPersona = (
    empresaId: number,
    id: number,
  ): PersonaDePrueba | undefined => {
    const persona = personas.get(id);
    return persona?.empresaId === empresaId ? persona : undefined;
  };

  /**
   * Reduce los datos de una persona a la representación pública utilizada
   * en los detalles de las solicitudes y sus pasos de aprobación.
   */
  const resumen = (persona: PersonaDePrueba): PersonaResumen => ({
    id: persona.id,
    nombres: persona.nombres,
    apellidos: persona.apellidos,
  });

  /** Busca una solicitud por ID y empresa. */
  const buscarSolicitud = (
    empresaId: number,
    id: number,
  ): SolicitudGuardada | undefined =>
    solicitudes.find(
      (solicitud) =>
        solicitud.empresaId === empresaId &&
        solicitud.detalle.id === id,
    );

  /**
   * Ejecuta un trabajo síncrono y devuelve su resultado como Promise<void>.
   *
   * Si el trabajo lanza un error, la promesa se rechaza. Esto permite que
   * los métodos en memoria mantengan la interfaz asíncrona del repositorio real.
   */
  const comoPromesa = (trabajo: () => void): Promise<void> => {
    try {
      trabajo();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Validaciones compartidas para las decisiones de aprobación               */
  /* ------------------------------------------------------------------------ */

  /**
   * Comprueba que una decisión pueda ejecutarse.
   *
   * Requisitos:
   * - La solicitud debe existir en la empresa indicada.
   * - La solicitud debe continuar en trámite.
   * - El paso debe existir y permanecer pendiente.
   * - La persona que decide debe ser el aprobador asignado al paso.
   *
   * Si alguna condición falla, se rechaza la operación como en el repositorio
   * real. Así se evita aprobar, negar o resolver dos veces el mismo paso.
   */
  const bloquearDecision = (
    empresaId: number,
    datos: DatosDecision,
  ): {
    guardada: SolicitudGuardada;
    paso: PasoAprobacion;
    quien: PersonaDePrueba;
  } => {
    const guardada = buscarSolicitud(empresaId, datos.solicitudId);

    if (!guardada) {
      throw AppError.noEncontrado('La solicitud no existe');
    }

    if (!ESTADOS_EN_TRAMITE.includes(guardada.detalle.estado)) {
      throw AppError.conflicto(MENSAJE_PASO_RESUELTO);
    }

    const paso = guardada.detalle.pasos.find(
      (elemento) => elemento.id === datos.pasoId,
    );

    if (
      paso?.estado !== 'PENDIENTE' ||
      paso.aprobador.id !== datos.aprobadorId
    ) {
      throw AppError.conflicto(MENSAJE_PASO_RESUELTO);
    }

    const quien = buscarPersona(empresaId, datos.aprobadorId);

    if (!quien) {
      throw new Error('Referencia invalida');
    }

    return { guardada, paso, quien };
  };

  /**
   * Registra la resolución de un paso y conserva sus datos históricos.
   *
   * Cuando el sistema escala automáticamente un paso, quien decide es null,
   * porque el cambio lo ejecuta el proceso automático y no un usuario.
   */
  const cerrarPaso = (
    paso: PasoAprobacion,
    estado: 'APROBADO' | 'NEGADO' | 'CANCELADO' | 'ESCALADO',
    quien: PersonaDePrueba | null,
    decididoAt: Date,
    motivo: string | null,
  ): void => {
    paso.estado = estado;
    paso.decididoPor = quien ? resumen(quien) : null;
    paso.decididoAt = decididoAt;
    paso.motivo = motivo;
  };

  /* ------------------------------------------------------------------------ */
  /* Simulación de notificaciones                                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Guarda una notificación en memoria para verificarla desde los tests.
   *
   * No envía correos ni invoca servicios externos.
   */
  const avisar = (
    empresaId: number,
    solicitudId: number,
    notificacion: NotificacionNueva,
  ): void => {
    notificaciones.push({
      empresaId,
      usuarioId: notificacion.usuarioId,
      tipo: notificacion.tipo,
      referenciaId: solicitudId,
      mensaje: notificacion.mensaje,
    });
  };

  /* ------------------------------------------------------------------------ */
  /* Implementación del contrato IVacacionesRepository                        */
  /* ------------------------------------------------------------------------ */

  const repositorio: IVacacionesRepository = {
    /* ---------------------------------------------------------------------- */
    /* Consulta de solicitantes y configuración de la ruta                    */
    /* ---------------------------------------------------------------------- */

    /** Obtiene al solicitante si pertenece a la empresa indicada. */
    buscarSolicitante: (empresaId, usuarioId) =>
      Promise.resolve(buscarPersona(empresaId, usuarioId) ?? null),

    /**
     * Devuelve la ruta configurada para el nivel jerárquico del solicitante.
     * Si no existe una configuración, devuelve una ruta vacía.
     */
    listarRuta: (_empresaId, nivel) =>
      Promise.resolve(rutas.get(nivel) ?? []),

    /**
     * Resuelve al aprobador correspondiente al tipo requerido.
     *
     * El jefe inmediato se obtiene del solicitante; el jefe de área,
     * la autoridad máxima y el superadministrador se obtienen de la
     * configuración del escenario.
     *
     * Solo devuelve el ID si el aprobador existe, pertenece a la misma
     * empresa y tiene estado ACTIVO.
     */
    resolverAprobador: (empresaId, tipo, solicitante) => {
      let id: number | null = null;

      if (tipo === 'JEFE_INMEDIATO') {
        id = solicitante.jefeInmediatoId;
      } else if (tipo === 'JEFE_AREA') {
        id = aprobadores.jefeArea.get(solicitante.areaId) ?? null;
      } else if (tipo === 'AUTORIDAD_MAXIMA') {
        id = aprobadores.autoridadMaxima;
      } else {
        id = aprobadores.superadmin;
      }

      const persona = id === null
        ? undefined
        : buscarPersona(empresaId, id);

      return Promise.resolve(
        persona?.estado === 'ACTIVO' ? persona.id : null,
      );
    },

    /* ---------------------------------------------------------------------- */
    /* Identificación y procesamiento de pasos vencidos                       */
    /* ---------------------------------------------------------------------- */

    /**
     * Busca pasos de aprobación cuyo plazo haya vencido.
     *
     * Solo considera solicitudes en trámite y pasos que:
     * - Continúen en estado PENDIENTE.
     * - Tengan una fecha de vencimiento definida.
     * - Hayan alcanzado o superado su fecha límite.
     * - No estén asignados al SUPERADMIN, que es el nivel final.
     *
     * Los resultados se ordenan por fecha de vencimiento y, en caso de empate,
     * por ID de paso. El límite se normaliza para mantener acotado el trabajo.
     *
     * Este método solo identifica candidatos. La operación de escalamiento
     * debe volver a validar el estado del paso antes de modificarlo, porque
     * podría haber sido resuelto entre la consulta y el procesamiento.
     */
    listarPasosVencidos: (ahora, limite) => {
      const limiteEntero = Number.isFinite(limite)
        ? Math.trunc(limite)
        : 100;

      const limiteSeguro = Math.min(500, Math.max(1, limiteEntero));

      /**
       * Se conserva temporalmente la fecha para ordenar los resultados.
       * PasoVencido no necesita exponerla en el contrato del dominio.
       */
      const vencidos: {
        fechaVencimiento: number;
        paso: PasoVencido;
      }[] = [];

      for (const guardada of solicitudes) {
        if (!ESTADOS_EN_TRAMITE.includes(guardada.detalle.estado)) {
          continue;
        }

        for (const paso of guardada.detalle.pasos) {
          if (
            paso.estado !== 'PENDIENTE' ||
            paso.venceAt === null ||
            paso.venceAt.getTime() > ahora.getTime() ||
            paso.tipoAprobador === 'SUPERADMIN'
          ) {
            continue;
          }

          vencidos.push({
            fechaVencimiento: paso.venceAt.getTime(),
            paso: {
              empresaId: guardada.empresaId,
              solicitudId: guardada.detalle.id,
              pasoId: paso.id,
              orden: paso.orden,
              tipoAprobador: paso.tipoAprobador,
              solicitanteId: guardada.detalle.solicitante.id,
            },
          });
        }
      }

      vencidos.sort(
        (a, b) =>
          a.fechaVencimiento - b.fechaVencimiento ||
          a.paso.pasoId - b.paso.pasoId,
      );

      return Promise.resolve(
        vencidos
          .slice(0, limiteSeguro)
          .map(({ paso }) => paso),
      );
    },

    /**
     * Escala una solicitud cuyo paso de aprobación ha vencido.
     *
     * Antes de modificar el historial, vuelve a verificar que la solicitud
     * siga en trámite y que el paso continúe pendiente y vencido. Esta
     * segunda validación evita escalar un paso que otro proceso ya resolvió.
     *
     * Si el nuevo aprobador no pertenece a la empresa o no está activo,
     * no se modifica la solicitud y se devuelve false.
     *
     * Si las validaciones se cumplen:
     * 1. Marca el paso vencido como ESCALADO.
     * 2. Conserva el motivo y la fecha del escalamiento en el historial.
     * 3. Crea un nuevo paso pendiente para el siguiente aprobador.
     * 4. Registra el origen ESCALAMIENTO_PLAZO y el nuevo plazo de decisión.
     *
     * El servicio determina si corresponde escalar a la autoridad máxima
     * o al superadministrador. Este método ejecuta el cambio solicitado.
     */
    escalarPasoVencido: (
      empresaId,
      datos: DatosEscalamientoPlazo,
      ahora,
    ) => {
      const guardada = buscarSolicitud(empresaId, datos.solicitudId);

      if (
        !guardada ||
        !ESTADOS_EN_TRAMITE.includes(guardada.detalle.estado)
      ) {
        return Promise.resolve(false);
      }

      const paso = guardada.detalle.pasos.find(
        (elemento) => elemento.id === datos.pasoId,
      );

      if (
        !paso ||
        paso.estado !== 'PENDIENTE' ||
        paso.tipoAprobador === 'SUPERADMIN' ||
        paso.venceAt === null ||
        paso.venceAt.getTime() > ahora.getTime()
      ) {
        return Promise.resolve(false);
      }

      // No se permite que el escalamiento cree un segundo paso pendiente.
      const otroPasoPendiente = guardada.detalle.pasos.some(
        (elemento) =>
          elemento.id !== paso.id &&
          elemento.estado === 'PENDIENTE',
      );

      if (otroPasoPendiente) {
        return Promise.resolve(false);
      }

      const aprobador = buscarPersona(
        empresaId,
        datos.nuevoAprobadorId,
      );

      if (
        !aprobador ||
        aprobador.estado !== 'ACTIVO' ||
        aprobador.id === guardada.detalle.solicitante.id
      ) {
        return Promise.resolve(false);
      }

      // Cierra el paso vencido sin atribuir la decisión a un usuario.
      cerrarPaso(
        paso,
        'ESCALADO',
        null,
        datos.escaladoAt,
        datos.motivo,
      );

      // Crea el nuevo paso con su propio plazo de aprobación.
      siguientePaso += 1;

      guardada.detalle.pasos.push({
        id: siguientePaso,
        orden: datos.nuevaOrden,
        tipoAprobador: datos.nuevoTipoAprobador,
        origen: 'ESCALAMIENTO_PLAZO',
        estado: 'PENDIENTE',
        aprobador: resumen(aprobador),
        aprobadorDisponible:
          aprobador.estado === 'ACTIVO' &&
          !ausentes.has(aprobador.id),
        decididoPor: null,
        motivo: datos.motivo,
        asignadoAt: datos.escaladoAt,
        venceAt: datos.nuevaVenceAt,
        decididoAt: null,
      });

      return Promise.resolve(true);
    },

    /* ---------------------------------------------------------------------- */
    /* Consulta de feriados y validaciones de fechas                          */
    /* ---------------------------------------------------------------------- */

    /**
     * Devuelve los feriados comprendidos entre las fechas indicadas,
     * incluyendo ambas fechas. Los resultados se ordenan cronológicamente.
     */
    feriadosEntre: (inicio, fin) =>
      Promise.resolve(
        [...feriados]
          .filter((fecha) => fecha >= inicio && fecha <= fin)
          .sort(),
      ),

    /**
     * Comprueba si existe otra solicitud del mismo usuario cuyos días
     * se crucen con el intervalo consultado.
     *
     * Se consideran las solicitudes pendientes, con visto bueno y autorizadas.
     * Las solicitudes negadas o canceladas no bloquean nuevas fechas.
     */
    existeSolapamiento: (empresaId, usuarioId, inicio, fin) =>
      Promise.resolve(
        solicitudes.some(
          ({ empresaId: empresa, detalle }) =>
            empresa === empresaId &&
            detalle.solicitante.id === usuarioId &&
            ['PENDIENTE', 'VISTO_BUENO', 'AUTORIZADA'].includes(
              detalle.estado,
            ) &&
            detalle.fechaInicio <= fin &&
            detalle.fechaFin >= inicio,
        ),
      ),

    /**
     * Calcula el saldo disponible restando las reservas de las solicitudes
     * que siguen en trámite al saldo base de la persona.
     *
     * Una solicitud autorizada deja de reservar días porque estos ya se
     * descuentan del saldo base en autorizarSolicitud.
     */
    saldoDisponible: (empresaId, usuarioId) => {
      const reservados = solicitudes
        .filter(
          (solicitud) =>
            solicitud.empresaId === empresaId &&
            solicitud.detalle.solicitante.id === usuarioId &&
            ESTADOS_EN_TRAMITE.includes(solicitud.detalle.estado),
        )
        .reduce(
          (total, solicitud) =>
            total + solicitud.detalle.diasSolicitados,
          0,
        );

      return Promise.resolve(
        Math.max(0, (saldos.get(usuarioId) ?? 0) - reservados),
      );
    },

    /* ---------------------------------------------------------------------- */
    /* Registro de solicitudes                                                */
    /* ---------------------------------------------------------------------- */

    /**
     * Registra una solicitud con su primer paso pendiente.
     *
     * Genera un número de trámite correlativo por empresa y año, determina
     * si la solicitud es programada según la anticipación y almacena los
     * datos necesarios para consultar posteriormente su estado e historial.
     *
     * Las referencias del solicitante y del primer aprobador deben existir
     * dentro de la empresa indicada.
     */
    registrarSolicitud: (empresaId, datos: DatosNuevaSolicitud) => {
      const solicitante = buscarPersona(empresaId, datos.usuarioId);
      const aprobador = buscarPersona(
        empresaId,
        datos.primerPaso.aprobadorId,
      );

      if (!solicitante || !aprobador) {
        return Promise.reject(new Error('Referencia invalida'));
      }

      // Genera la secuencia independiente de cada empresa y año.
      const anio = datos.fechaSolicitud.slice(0, 4);
      const clave = `${String(empresaId)}-${anio}`;
      const numero = (contadores.get(clave) ?? 0) + 1;
      contadores.set(clave, numero);

      // La anticipación se calcula en días naturales, según la fecha solicitada.
      const diasAnticipacion =
        (
          Date.parse(`${datos.fechaInicio}T00:00:00Z`) -
          Date.parse(`${datos.fechaSolicitud}T00:00:00Z`)
        ) / 86_400_000;

      siguienteId += 1;
      siguientePaso += 1;

      const paso: PasoAprobacion = {
        id: siguientePaso,
        orden: 1,
        tipoAprobador: datos.primerPaso.tipoAprobador,
        origen: 'RUTA',
        estado: 'PENDIENTE',
        aprobador: resumen(aprobador),
        aprobadorDisponible:
          aprobador.estado === 'ACTIVO' &&
          !ausentes.has(aprobador.id),
        decididoPor: null,
        motivo: null,
        asignadoAt: datos.primerPaso.asignadoAt,
        venceAt: datos.primerPaso.venceAt,
        decididoAt: null,
      };

      solicitudes.push({
        empresaId,
        detalle: {
          id: siguienteId,
          ordenTramite:
            `VAC-${anio}-${String(numero).padStart(6, '0')}`,
          solicitante: {
            ...resumen(solicitante),
            cedula: solicitante.cedula,
          },
          area: {
            id: datos.areaId,
            detalle: `Area ${String(datos.areaId)}`,
          },
          cargo: {
            id: datos.cargoId,
            detalle: `Cargo ${String(datos.cargoId)}`,
          },
          lugar: datos.lugar,
          telefonoLocalizacion: datos.telefonoLocalizacion,
          solicitadoAt: datos.solicitadoAt,
          fechaSolicitud: datos.fechaSolicitud,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          diasSolicitados: datos.diasSolicitados,
          justificacion: datos.justificacion,
          tipo: diasAnticipacion >= 7
            ? 'PROGRAMADA'
            : 'NO_PROGRAMADA',
          estado: 'PENDIENTE',
          motivoResolucion: null,
          fechaResolucion: null,
          pasos: [paso],
        },
      });

      return Promise.resolve(siguienteId);
    },

    /* ---------------------------------------------------------------------- */
    /* Aprobaciones intermedias                                               */
    /* ---------------------------------------------------------------------- */

    /**
     * Aprueba el paso actual y asigna el siguiente paso de la ruta.
     *
     * La solicitud pasa a VISTO_BUENO mientras continúa el flujo. El nuevo
     * paso comienza pendiente y conserva la fecha de asignación y vencimiento
     * proporcionadas por el servicio.
     */
    aprobarPasoIntermedio: (empresaId, datos: DatosAprobacionIntermedia) =>
      comoPromesa(() => {
        const { guardada, paso, quien } = bloquearDecision(
          empresaId,
          datos,
        );

        const siguiente = buscarPersona(
          empresaId,
          datos.siguiente.aprobadorId,
        );

        if (!siguiente) {
          throw new Error('Referencia invalida');
        }

        cerrarPaso(
          paso,
          'APROBADO',
          quien,
          datos.decididoAt,
          datos.motivo,
        );

        guardada.detalle.estado = 'VISTO_BUENO';
        siguientePaso += 1;

        guardada.detalle.pasos.push({
          id: siguientePaso,
          orden: datos.siguiente.orden,
          tipoAprobador: datos.siguiente.tipoAprobador,
          origen: 'RUTA',
          estado: 'PENDIENTE',
          aprobador: resumen(siguiente),
          aprobadorDisponible:
            siguiente.estado === 'ACTIVO' &&
            !ausentes.has(siguiente.id),
          decididoPor: null,
          motivo: null,
          asignadoAt: datos.siguiente.asignadoAt,
          venceAt: datos.siguiente.venceAt,
          decididoAt: null,
        });
      }),

    /* ---------------------------------------------------------------------- */
    /* Resolución final de solicitudes                                        */
    /* ---------------------------------------------------------------------- */

    /**
     * Autoriza la solicitud y registra la resolución final.
     *
     * El saldo base se reduce por los días autorizados. La reserva deja de
     * descontarse por separado porque la solicitud ya no está en trámite.
     * También se registra la notificación dirigida al usuario correspondiente.
     */
    autorizarSolicitud: (empresaId, datos: DatosResolucionFinal) =>
      comoPromesa(() => {
        const { guardada, paso, quien } = bloquearDecision(
          empresaId,
          datos,
        );

        cerrarPaso(
          paso,
          'APROBADO',
          quien,
          datos.decididoAt,
          datos.motivo,
        );

        const detalle = guardada.detalle;
        detalle.estado = 'AUTORIZADA';
        detalle.fechaResolucion = datos.decididoAt;

        const saldo = saldos.get(detalle.solicitante.id);

        if (saldo !== undefined) {
          saldos.set(
            detalle.solicitante.id,
            saldo - detalle.diasSolicitados,
          );
        }

        avisar(empresaId, datos.solicitudId, datos.notificacion);
      }),

    /**
     * Niega la solicitud, conserva el motivo y registra la fecha de resolución.
     *
     * La solicitud deja de estar en trámite y, por tanto, sus días reservados
     * vuelven a estar disponibles para otras solicitudes.
     */
    negarSolicitud: (empresaId, datos: DatosResolucionFinal) =>
      comoPromesa(() => {
        const { guardada, paso, quien } = bloquearDecision(
          empresaId,
          datos,
        );

        cerrarPaso(
          paso,
          'NEGADO',
          quien,
          datos.decididoAt,
          datos.motivo,
        );

        guardada.detalle.estado = 'NEGADA';
        guardada.detalle.motivoResolucion = datos.motivo;
        guardada.detalle.fechaResolucion = datos.decididoAt;

        avisar(empresaId, datos.solicitudId, datos.notificacion);
      }),

    /* ---------------------------------------------------------------------- */
    /* Cancelación de solicitudes                                             */
    /* ---------------------------------------------------------------------- */

    /**
     * Permite al propio solicitante cancelar una solicitud que siga en trámite.
     *
     * Si existe un paso pendiente, se cierra como CANCELADO. La operación
     * rechaza solicitudes inexistentes, ya resueltas o pertenecientes a
     * otra persona.
     */
    cancelarSolicitud: (empresaId, datos: DatosCancelacion) =>
      comoPromesa(() => {
        const guardada = buscarSolicitud(
          empresaId,
          datos.solicitudId,
        );

        if (!guardada) {
          throw AppError.noEncontrado('La solicitud no existe');
        }

        const detalle = guardada.detalle;

        if (!ESTADOS_EN_TRAMITE.includes(detalle.estado)) {
          throw AppError.conflicto(MENSAJE_PASO_RESUELTO);
        }

        if (detalle.solicitante.id !== datos.usuarioId) {
          throw AppError.prohibido(
            'Solo quien la solicito puede cancelarla',
          );
        }

        const quien = buscarPersona(empresaId, datos.usuarioId);

        if (!quien) {
          throw new Error('Referencia invalida');
        }

        const pendiente = detalle.pasos.find(
          (paso) => paso.estado === 'PENDIENTE',
        );

        if (pendiente) {
          cerrarPaso(
            pendiente,
            'CANCELADO',
            quien,
            datos.canceladaAt,
            null,
          );
        }

        detalle.estado = 'CANCELADA';
        detalle.motivoResolucion = datos.motivo;
        detalle.fechaResolucion = datos.canceladaAt;
      }),

    /* ---------------------------------------------------------------------- */
    /* Consultas de solicitudes                                               */
    /* ---------------------------------------------------------------------- */

    /** Recupera el detalle de una solicitud o null si no existe. */
    obtenerSolicitud: (empresaId, id) =>
      Promise.resolve(
        buscarSolicitud(empresaId, id)?.detalle ?? null,
      ),

    /**
     * Lista las solicitudes de una persona, con filtro opcional por estado
     * y paginación.
     *
     * Las más recientes aparecen primero. La respuesta contiene los campos
     * de resumen necesarios para mostrar el listado y el total sin paginar.
     */
    listarSolicitudesDe: (
      empresaId,
      usuarioId,
      filtros: FiltrosSolicitudes,
    ) => {
      const propias = solicitudes
        .filter(
          (solicitud) =>
            solicitud.empresaId === empresaId &&
            solicitud.detalle.solicitante.id === usuarioId &&
            (
              filtros.estado === undefined ||
              solicitud.detalle.estado === filtros.estado
            ),
        )
        .map((solicitud) => solicitud.detalle)
        .sort((a, b) => b.id - a.id);

      const desde = (filtros.pagina - 1) * filtros.porPagina;

      return Promise.resolve({
        solicitudes: propias
          .slice(desde, desde + filtros.porPagina)
          .map((detalle) => ({
            id: detalle.id,
            ordenTramite: detalle.ordenTramite,
            fechaInicio: detalle.fechaInicio,
            fechaFin: detalle.fechaFin,
            diasSolicitados: detalle.diasSolicitados,
            tipo: detalle.tipo,
            estado: detalle.estado,
            solicitadoAt: detalle.solicitadoAt,
          })),
        total: propias.length,
      });
    },
  };

  /* ------------------------------------------------------------------------ */
  /* Exposición del estado para preparar y verificar escenarios               */
  /* ------------------------------------------------------------------------ */

  return {
    repositorio,
    personas,
    solicitudes,
    notificaciones,
    feriados,
    saldos,
    rutas,
    aprobadores,
    ausentes,
  };
}
