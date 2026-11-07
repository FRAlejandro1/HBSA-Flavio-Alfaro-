// Reglas de negocio de las solicitudes de vacaciones: fechas, tipo, dias laborables, saldo, ruta de aprobacion,
// decisiones de quien aprueba y quien puede ver cada solicitud. Las restricciones de la base las traduce el repository.
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import { diasDeAnticipacion } from '../../shared/utils/fechas';
import { fechaEnZona } from '../../shared/utils/zonaHoraria';
import {
  ESTADOS_EN_TRAMITE,
  MENSAJE_SOLAPAMIENTO,
  mensajeSaldoInsuficiente,
} from './vacaciones.dominio';
import type {
  DatosEscalamientoPlazo,
  DatosPrimerPaso,
  DatosSiguientePaso,
  FiltrosSolicitudes,
  PaginaSolicitudes,
  PasoAprobacion,
  PasoVencido,
  Solicitante,
  SolicitudDetalle,
  TipoAprobador,
} from './vacaciones.dominio';
import type { IVacacionesRepository } from './vacaciones.repository';
import type { CrearSolicitudEntrada, DecisionEntrada } from './vacaciones.validators';

// Parametros institucionales que determinan las reglas operativas de vacaciones.
export interface ConfiguracionOperativaVacaciones {
  plazoHoras: number;
  diasVacacionesAnuales: number;
  zonaHoraria: string;
  diasAnticipacionVacaciones: number;
}

export interface DependenciasVacacionesService {
  repositorio: IVacacionesRepository;
  // Obtiene la configuracion vigente del hospital al que pertenece la operacion.
  obtenerConfiguracionInstitucional: (
    empresaId: number,
  ) => Promise<ConfiguracionOperativaVacaciones | null>;
  // Dias laborables entre dos fechas (ambas incluidas): lunes a viernes sin los feriados indicados.
  calcularDiasLaborables: (inicio: string, fin: string, feriados: ReadonlySet<string>) => number;
  // Crea los periodos de vacaciones que le falten a la persona.
  asegurarPeriodos?: (empresaId: number, usuarioId: number, hoy: string) => Promise<void>;
  // Instante actual; detras de una funcion para fijarlo en las pruebas.
  ahora?: () => Date;
}

// Que decirle a la persona cuando la ruta no encuentra quien apruebe.
const MENSAJE_SIN_APROBADOR: Record<TipoAprobador, string> = {
  JEFE_INMEDIATO: 'No tienes un jefe inmediato activo asignado: pide a Talento Humano que lo registre',
  JEFE_AREA: 'Tu area no tiene un jefe activo asignado: pide a Talento Humano que lo registre',
  DIRECTOR: 'El hospital no tiene exactamente un DIRECTOR activo registrado',
  SUPERADMIN: 'El hospital no tiene un SUPERADMIN activo registrado',
};

// Quien decidio, dicho como lo lee la persona en su notificacion.
const POR_QUIEN: Record<TipoAprobador, string> = {
  JEFE_INMEDIATO: ' por tu jefe',
  JEFE_AREA: ' por tu jefe',
  DIRECTOR: ' por el Director',
  SUPERADMIN: '',
};

// La columna de notificaciones admite 300 caracteres: del motivo se muestra solo el comienzo.
const LARGO_MAXIMO_MOTIVO_AVISO = 200;

// Limite de aprobaciones representable por la columna orden de la base de datos.
const ORDEN_MAXIMO_APROBACION = 255;

const MS_POR_HORA = 3_600_000;

function mensajeAprobada(nombres: string, tipo: TipoAprobador): string {
  return `¡Buenas noticias, ${nombres}! Tu solicitud de Vacaciones fue aprobada${POR_QUIEN[tipo]}.`;
}

function mensajeNegada(tipo: TipoAprobador, motivo: string | null): string {
  const base = `Tu solicitud de Vacaciones fue negada${POR_QUIEN[tipo]}.`;
  return motivo === null ? base : `${base} Motivo: ${motivo.slice(0, LARGO_MAXIMO_MOTIVO_AVISO)}`;
}

export class VacacionesService {
  private readonly ahora: () => Date;

  constructor(private readonly deps: DependenciasVacacionesService) {
    this.ahora = deps.ahora ?? (() => new Date());
  }

  // Recupera la configuracion del hospital y evita operar con reglas institucionales inexistentes.
  private async obtenerConfiguracion(empresaId: number): Promise<ConfiguracionOperativaVacaciones> {
    const configuracion = await this.deps.obtenerConfiguracionInstitucional(empresaId);

    if (configuracion === null) {
      throw AppError.reglaDeNegocio(
        `No existe configuracion institucional para el hospital ${String(empresaId)}`,
      );
    }

    return configuracion;
  }

  // La persona solicita sus propias vacaciones; el primer paso se asigna segun la ruta de su nivel.
  async crear(actor: UsuarioAutenticado, entrada: CrearSolicitudEntrada): Promise<SolicitudDetalle> {
    const repositorio = this.deps.repositorio;
    const empresaId = actor.empresaId;
    const configuracion = await this.obtenerConfiguracion(empresaId);

    // Fecha y hora las pone el servidor; el dia de la solicitud corresponde a la zona del hospital.
    const solicitadoAt = this.ahora();
    const hoy = fechaEnZona(solicitadoAt, configuracion.zonaHoraria);

    const solicitante = await repositorio.buscarSolicitante(empresaId, actor.id);
    if (!solicitante) {
      throw AppError.noEncontrado('La persona no existe');
    }
    if (solicitante.estado === 'INACTIVO') {
      throw AppError.reglaDeNegocio('Una persona dada de baja no puede solicitar vacaciones');
    }

    if (entrada.fechaInicio < hoy) {
      throw AppError.reglaDeNegocio('La fecha de inicio no puede ser anterior a hoy');
    }

    // La clasificacion y la justificacion usan el umbral institucional vigente al crear la solicitud.
    const diasAnticipacionAplicada = configuracion.diasAnticipacionVacaciones;
    const diasAnticipacion = diasDeAnticipacion(hoy, entrada.fechaInicio);
    const justificacion = entrada.justificacion ?? null;

    if (diasAnticipacion < diasAnticipacionAplicada && justificacion === null) {
      throw AppError.reglaDeNegocio(
        `Una solicitud con menos de ${String(diasAnticipacionAplicada)} dias de anticipacion necesita justificacion`,
      );
    }

    const feriados = new Set(await repositorio.feriadosEntre(entrada.fechaInicio, entrada.fechaFin));
    const diasSolicitados = this.deps.calcularDiasLaborables(
      entrada.fechaInicio,
      entrada.fechaFin,
      feriados,
    );

    if (diasSolicitados <= 0) {
      throw AppError.reglaDeNegocio('Las fechas indicadas no incluyen ningun dia laborable');
    }

    // La comprobacion definitiva de solapamiento y saldo se repite dentro de la transaccion.
    if (await repositorio.existeSolapamiento(
      empresaId,
      actor.id,
      entrada.fechaInicio,
      entrada.fechaFin,
    )) {
      throw AppError.conflicto(MENSAJE_SOLAPAMIENTO);
    }

    // Los periodos se crean al hacer falta: asi el saldo siempre sale de periodos al dia.
    await this.deps.asegurarPeriodos?.(empresaId, actor.id, hoy);

    // Los dias de las solicitudes en tramite ya estan reservados; el descuento FIFO se hace al autorizar.
    const saldo = await repositorio.saldoDisponible(empresaId, actor.id, entrada.fechaInicio);
    if (saldo < diasSolicitados) {
      throw AppError.reglaDeNegocio(mensajeSaldoInsuficiente(saldo, diasSolicitados));
    }

    const primerPaso = await this.armarPrimerPaso(
      empresaId,
      solicitante,
      solicitadoAt,
      configuracion.plazoHoras,
    );

    const id = await repositorio.registrarSolicitud(empresaId, {
      usuarioId: actor.id,
      areaId: solicitante.areaId,
      cargoId: solicitante.cargoId,
      lugar: solicitante.lugar,
      telefonoLocalizacion: entrada.telefonoLocalizacion ?? solicitante.telefono,
      solicitadoAt,
      fechaSolicitud: hoy,
      diasAnticipacionAplicada,
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      diasSolicitados,
      justificacion,
      primerPaso,
    });

    return this.obtenerDetalle(empresaId, id, hoy);
  }

  // Solo lo ven el solicitante, quienes intervienen en la aprobacion, Talento Humano y el SUPERADMIN.
  async obtener(actor: UsuarioAutenticado, id: number): Promise<SolicitudDetalle> {
    const configuracion = await this.obtenerConfiguracion(actor.empresaId);
    const hoy = fechaEnZona(this.ahora(), configuracion.zonaHoraria);
    const solicitud = await this.obtenerDetalle(actor.empresaId, id, hoy);

    if (!this.puedeVer(actor, solicitud)) {
      throw AppError.noEncontrado('La solicitud no existe');
    }

    return solicitud;
  }

  // Historial de las solicitudes de la propia persona.
  async listarPropias(
    actor: UsuarioAutenticado,
    filtros: FiltrosSolicitudes,
  ): Promise<PaginaSolicitudes> {
    const { solicitudes, total } = await this.deps.repositorio.listarSolicitudesDe(
      actor.empresaId,
      actor.id,
      filtros,
    );

    return { solicitudes, total, pagina: filtros.pagina, porPagina: filtros.porPagina };
  }

  // Procesa los pasos vencidos y escala cada uno a la autoridad que corresponda.
  async procesarEscalamientosVencidos(limite = 100): Promise<number> {
    const repositorio = this.deps.repositorio;
    const ahora = this.ahora();
    const pasos: PasoVencido[] = await repositorio.listarPasosVencidos(ahora, limite);
    let escalados = 0;

    for (const paso of pasos) {
      try {
        // SUPERADMIN es la ultima instancia: su vencimiento no genera otro paso.
        if (paso.tipoAprobador === 'SUPERADMIN') {
          continue;
        }

        const solicitante = await repositorio.buscarSolicitante(
          paso.empresaId,
          paso.solicitanteId,
        );

        if (!solicitante) {
          logger.error('No se puede escalar la solicitud: no existe el solicitante', {
            empresaId: paso.empresaId,
            solicitudId: paso.solicitudId,
            pasoId: paso.pasoId,
            solicitanteId: paso.solicitanteId,
          });
          continue;
        }

        // El vencimiento de un jefe o delegado escala al DIRECTOR; el del DIRECTOR, al SUPERADMIN.
        const nuevoTipoAprobador: TipoAprobador =
          paso.tipoAprobador === 'DIRECTOR' ? 'SUPERADMIN' : 'DIRECTOR';

        const nuevoAprobadorId = await repositorio.resolverAprobador(
          paso.empresaId,
          nuevoTipoAprobador,
          solicitante,
        );

        // No se sustituye un DIRECTOR inexistente por SUPERADMIN: debe corregirse la configuracion institucional.
        if (nuevoAprobadorId === null || nuevoAprobadorId === solicitante.id) {
          logger.error('No se puede escalar la solicitud: no hay un aprobador valido', {
            empresaId: paso.empresaId,
            solicitudId: paso.solicitudId,
            pasoId: paso.pasoId,
            tipoAprobadorRequerido: nuevoTipoAprobador,
          });
          continue;
        }

        const nuevaOrden = paso.orden + 1;
        if (!Number.isSafeInteger(nuevaOrden) || nuevaOrden > ORDEN_MAXIMO_APROBACION) {
          logger.error('No se puede escalar la solicitud: se agoto el orden de aprobacion', {
            empresaId: paso.empresaId,
            solicitudId: paso.solicitudId,
            pasoId: paso.pasoId,
            orden: paso.orden,
          });
          continue;
        }

        const configuracion = await this.obtenerConfiguracion(paso.empresaId);

        const datos: DatosEscalamientoPlazo = {
          solicitudId: paso.solicitudId,
          pasoId: paso.pasoId,
          nuevoTipoAprobador,
          nuevoAprobadorId,
          nuevaOrden,
          escaladoAt: ahora,
          nuevaVenceAt: this.venceDesde(ahora, configuracion.plazoHoras),
          motivo: `Escalamiento automatico por vencimiento del plazo de aprobacion de ${paso.tipoAprobador}.`,
        };

        // El repositorio vuelve a comprobar estado y vencimiento dentro de la transaccion.
        const escalado = await repositorio.escalarPasoVencido(
          paso.empresaId,
          datos,
          ahora,
        );

        if (escalado) {
          escalados += 1;
          logger.info('Solicitud escalada por vencimiento del plazo', {
            empresaId: paso.empresaId,
            solicitudId: paso.solicitudId,
            pasoAnteriorId: paso.pasoId,
            nuevoTipoAprobador,
            nuevoAprobadorId,
          });
        }
      } catch (error) {
        // Un error no debe impedir que se procesen los demas pasos vencidos.
        logger.error('Error al procesar el escalamiento de una solicitud', {
          empresaId: paso.empresaId,
          solicitudId: paso.solicitudId,
          pasoId: paso.pasoId,
          detalle: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return escalados;
  }

  // Aprueba el paso pendiente: abre el siguiente o autoriza y descuenta los dias.
  async aprobar(
    actor: UsuarioAutenticado,
    id: number,
    entrada: DecisionEntrada,
  ): Promise<SolicitudDetalle> {
    const repositorio = this.deps.repositorio;
    const empresaId = actor.empresaId;
    const { solicitud, paso, hoy } = await this.cargarParaDecidir(actor, id);
    const decididoAt = this.ahora();

    const decision = {
      solicitudId: solicitud.id,
      pasoId: paso.id,
      aprobadorId: paso.aprobador.id,
      decididoPorId: actor.id,
      delegacionId: null,
      decididoAt,
      motivo: entrada.motivo ?? null,
    };

    // La aprobacion de un paso escalado por vencimiento autoriza directamente la solicitud.
    if (paso.origen === 'ESCALAMIENTO_PLAZO') {
      await repositorio.autorizarSolicitud(empresaId, {
        ...decision,
        notificacion: {
          usuarioId: solicitud.solicitante.id,
          tipo: 'SOLICITUD_APROBADA',
          mensaje: mensajeAprobada(solicitud.solicitante.nombres, paso.tipoAprobador),
        },
      });

      return this.obtenerDetalle(empresaId, id, hoy);
    }

    const solicitante = await repositorio.buscarSolicitante(empresaId, solicitud.solicitante.id);
    if (!solicitante) {
      throw AppError.noEncontrado('La persona que solicito ya no existe');
    }

    const ruta = await repositorio.listarRuta(empresaId, solicitante.nivelJerarquico);
    const tipoSiguiente = ruta[paso.orden];

    if (tipoSiguiente === undefined) {
      await repositorio.autorizarSolicitud(empresaId, {
        ...decision,
        notificacion: {
          usuarioId: solicitud.solicitante.id,
          tipo: 'SOLICITUD_APROBADA',
          mensaje: mensajeAprobada(solicitud.solicitante.nombres, paso.tipoAprobador),
        },
      });
    } else {
      const siguiente = await this.armarSiguientePaso(
        empresaId,
        solicitante,
        tipoSiguiente,
        paso.orden + 1,
        decididoAt,
      );

      await repositorio.aprobarPasoIntermedio(empresaId, { ...decision, siguiente });
    }

    return this.obtenerDetalle(empresaId, id, hoy);
  }

  // Niega la solicitud; el motivo es opcional.
  async negar(
    actor: UsuarioAutenticado,
    id: number,
    entrada: DecisionEntrada,
  ): Promise<SolicitudDetalle> {
    const empresaId = actor.empresaId;
    const { solicitud, paso, hoy } = await this.cargarParaDecidir(actor, id);
    const motivo = entrada.motivo ?? null;

    await this.deps.repositorio.negarSolicitud(empresaId, {
      solicitudId: solicitud.id,
      pasoId: paso.id,
      aprobadorId: paso.aprobador.id,
      decididoPorId: actor.id,
      delegacionId: null,
      decididoAt: this.ahora(),
      motivo,
      notificacion: {
        usuarioId: solicitud.solicitante.id,
        tipo: 'SOLICITUD_NEGADA',
        mensaje: mensajeNegada(paso.tipoAprobador, motivo),
      },
    });

    return this.obtenerDetalle(empresaId, id, hoy);
  }

  // La persona solicitante solo puede cancelar mientras la solicitud este PENDIENTE.
  async cancelar(
    actor: UsuarioAutenticado,
    id: number,
    entrada: DecisionEntrada,
  ): Promise<SolicitudDetalle> {
    const empresaId = actor.empresaId;
    const configuracion = await this.obtenerConfiguracion(empresaId);
    const hoy = fechaEnZona(this.ahora(), configuracion.zonaHoraria);
    const solicitud = await this.obtenerDetalle(empresaId, id, hoy);

    if (solicitud.solicitante.id !== actor.id) {
      if (!this.puedeVer(actor, solicitud)) {
        throw AppError.noEncontrado('La solicitud no existe');
      }

      throw AppError.prohibido('Solo quien la solicito puede cancelarla');
    }

    if (solicitud.estado !== 'PENDIENTE') {
      throw AppError.conflicto(
        'Solo puedes cancelar una solicitud que se encuentre pendiente',
      );
    }

    await this.deps.repositorio.cancelarSolicitud(empresaId, {
      solicitudId: id,
      usuarioId: actor.id,
      canceladaAt: this.ahora(),
      motivo: entrada.motivo ?? null,
    });

    return this.obtenerDetalle(empresaId, id, hoy);
  }

  // Carga la solicitud y su paso pendiente, validando que el actor pueda verla y decidirla.
  private async cargarParaDecidir(
    actor: UsuarioAutenticado,
    id: number,
  ): Promise<{ solicitud: SolicitudDetalle; paso: PasoAprobacion; hoy: string }> {
    const configuracion = await this.obtenerConfiguracion(actor.empresaId);
    const hoy = fechaEnZona(this.ahora(), configuracion.zonaHoraria);
    const solicitud = await this.obtenerDetalle(actor.empresaId, id, hoy);

    if (!this.puedeVer(actor, solicitud)) {
      throw AppError.noEncontrado('La solicitud no existe');
    }

    if (!ESTADOS_EN_TRAMITE.includes(solicitud.estado)) {
      throw AppError.conflicto('La solicitud ya fue resuelta');
    }

    const paso = solicitud.pasos.find((p) => p.estado === 'PENDIENTE');
    if (!paso) {
      throw AppError.conflicto('La solicitud no tiene un paso pendiente');
    }

    // Decide quien tiene asignado el paso, no quien tenga cierto rol.
    if (paso.aprobador.id !== actor.id) {
      throw AppError.prohibido('Esta solicitud la debe resolver otra persona');
    }

    return { solicitud, paso, hoy };
  }

  private puedeVer(actor: UsuarioAutenticado, solicitud: SolicitudDetalle): boolean {
    return (
      solicitud.solicitante.id === actor.id ||
      actor.rol === 'TALENTO_HUMANO' ||
      actor.rol === 'SUPERADMIN' ||
      solicitud.pasos.some(
        (p) => p.aprobador.id === actor.id || p.decididoPor?.id === actor.id,
      )
    );
  }

  // Quien debe aprobar un paso de la ruta: una persona activa, distinta de quien solicita.
  private async elegirAprobador(
    empresaId: number,
    solicitante: Solicitante,
    tipo: TipoAprobador,
  ): Promise<number> {
    const aprobadorId = await this.deps.repositorio.resolverAprobador(
      empresaId,
      tipo,
      solicitante,
    );

    if (aprobadorId === null) {
      throw AppError.reglaDeNegocio(MENSAJE_SIN_APROBADOR[tipo]);
    }

    if (aprobadorId === solicitante.id) {
      throw AppError.reglaDeNegocio(
        'No puedes aprobar tu propia solicitud: pide a Talento Humano que revise tu ruta de aprobacion',
      );
    }

    return aprobadorId;
  }

  // Limite para responder un paso, calculado con el plazo vigente al asignarlo.
  private venceDesde(asignadoAt: Date, plazoHoras: number): Date {
    return new Date(asignadoAt.getTime() + plazoHoras * MS_POR_HORA);
  }

  // Asigna el primer paso; si no hay jefe inmediato activo, dirige la solicitud al DIRECTOR.
  private async armarPrimerPaso(
    empresaId: number,
    solicitante: Solicitante,
    solicitadoAt: Date,
    plazoHoras: number,
  ): Promise<DatosPrimerPaso> {
    const ruta = await this.deps.repositorio.listarRuta(
      empresaId,
      solicitante.nivelJerarquico,
    );
    const primerTipoAprobador = ruta[0];

    if (primerTipoAprobador === undefined) {
      throw AppError.reglaDeNegocio(
        'El hospital no tiene una ruta de aprobacion definida para tu nivel',
      );
    }

    let tipoAprobador: TipoAprobador = primerTipoAprobador;

    let aprobadorId = await this.deps.repositorio.resolverAprobador(
      empresaId,
      tipoAprobador,
      solicitante,
    );

    // Sin jefe inmediato activo, la solicitud se asigna directamente al DIRECTOR.
    if (aprobadorId === null && tipoAprobador === 'JEFE_INMEDIATO') {
      tipoAprobador = 'DIRECTOR';
      aprobadorId = await this.deps.repositorio.resolverAprobador(
        empresaId,
        tipoAprobador,
        solicitante,
      );
    }

    if (aprobadorId === null) {
      throw AppError.reglaDeNegocio(MENSAJE_SIN_APROBADOR[tipoAprobador]);
    }

    if (aprobadorId === solicitante.id) {
      throw AppError.reglaDeNegocio(
        'No puedes aprobar tu propia solicitud: pide a Talento Humano que revise tu ruta de aprobacion',
      );
    }

    return {
      tipoAprobador,
      aprobadorId,
      asignadoAt: solicitadoAt,
      venceAt: this.venceDesde(solicitadoAt, plazoHoras),
    };
  }

  // Paso que se abre cuando el anterior se aprueba y la ruta todavia tiene mas pasos.
  private async armarSiguientePaso(
    empresaId: number,
    solicitante: Solicitante,
    tipoAprobador: TipoAprobador,
    orden: number,
    asignadoAt: Date,
  ): Promise<DatosSiguientePaso> {
    const configuracion = await this.obtenerConfiguracion(empresaId);
    const aprobadorId = await this.elegirAprobador(
      empresaId,
      solicitante,
      tipoAprobador,
    );

    return {
      orden,
      tipoAprobador,
      aprobadorId,
      asignadoAt,
      venceAt: this.venceDesde(asignadoAt, configuracion.plazoHoras),
    };
  }

  private async obtenerDetalle(
    empresaId: number,
    id: number,
    hoy: string,
  ): Promise<SolicitudDetalle> {
    const solicitud = await this.deps.repositorio.obtenerSolicitud(empresaId, id, hoy);

    if (!solicitud) {
      throw AppError.noEncontrado('La solicitud no existe');
    }

    return solicitud;
  }
}