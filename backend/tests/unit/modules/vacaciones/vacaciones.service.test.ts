
// Pruebas del service de vacaciones con el repositorio en memoria y un reloj fijo.
import { describe, expect, it, vi } from 'vitest';
import type { PersonaDePrueba } from '../../../helpers/vacaciones';
import { VacacionesService } from '../../../../src/modules/vacaciones/vacaciones.service';
import type { CrearSolicitudEntrada } from '../../../../src/modules/vacaciones/vacaciones.validators';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import { contarDiasLaborablesDePrueba, crearVacacionesEnMemoria } from '../../../helpers/vacaciones';

// Jueves 15 de octubre de 2026, 10:00 en Guayaquil (15:00 UTC).
const AHORA = new Date('2026-10-15T15:00:00Z');

function persona(id: number, cambios: Partial<PersonaDePrueba> = {}): PersonaDePrueba {
  return {
    id,
    empresaId: 5,
    cedula: `09000000${String(id).padStart(2, '0')}`,
    nombres: `Nombre${String(id)}`,
    apellidos: `Apellido${String(id)}`,
    areaId: 10,
    cargoId: 20,
    nivelJerarquico: 5,
    telefono: '0990000000',
    jefeInmediatoId: null,
    estado: 'ACTIVO',
    lugar: 'Flavio Alfaro',
    ...cambios,
  };
}

function actor(id: number, rol: UsuarioAutenticado['rol'] = 'EMPLEADO', empresaId = 5): UsuarioAutenticado {
  return { id, empresaId, rol, jti: `jti-${String(id)}`, expira: 9_999_999_999 };
}

// Escenario: Luis (1) depende de Laura (2), Silvia (3) es subdirectora y Diego (4) es Rector.
function crearEscenario(
  plazoHoras = 48,
  ahora: (() => Date) | null = () => AHORA,
  asegurarPeriodos?: NonNullable<ConstructorParameters<typeof VacacionesService>[0]['asegurarPeriodos']>,
) {
  const memoria = crearVacacionesEnMemoria();
  const { personas } = memoria;

  personas.set(4, persona(4, { nivelJerarquico: 1 }));
  personas.set(3, persona(3, { nivelJerarquico: 2, jefeInmediatoId: 4 }));
  personas.set(2, persona(2, { nivelJerarquico: 3, jefeInmediatoId: 3 }));
  personas.set(1, persona(1, { jefeInmediatoId: 2 }));
  personas.set(9, persona(9, { nivelJerarquico: 4 }));
  personas.set(8, persona(8));

  memoria.saldos.set(1, 60);
  memoria.saldos.set(2, 60);
  memoria.saldos.set(3, 60);
  memoria.saldos.set(4, 60);
  memoria.saldos.set(8, 60);

  memoria.rutas.set(5, ['JEFE_INMEDIATO']);
  memoria.rutas.set(4, ['JEFE_INMEDIATO']);
  memoria.rutas.set(3, ['JEFE_INMEDIATO']);
  memoria.rutas.set(2, ['AUTORIDAD_MAXIMA']);
  memoria.rutas.set(1, ['SUPERADMIN']);

  memoria.aprobadores.autoridadMaxima = 4;
  memoria.aprobadores.superadmin = 7;
  personas.set(7, persona(7, { nivelJerarquico: 4 }));

  // Los días 2 y 3 de noviembre son feriados.
  memoria.feriados.add('2026-11-02');
  memoria.feriados.add('2026-11-03');

  const servicio = new VacacionesService({
    repositorio: memoria.repositorio,
    calcularDiasLaborables: contarDiasLaborablesDePrueba,
    obtenerConfiguracionInstitucional: () => Promise.resolve({
      plazoHoras,
      diasVacacionesAnuales: 30,
      zonaHoraria: 'America/Guayaquil',
      diasAnticipacionVacaciones: 3,
    }),
    ...(ahora ? { ahora } : {}),
    ...(asegurarPeriodos ? { asegurarPeriodos } : {}),
  });

  return { ...memoria, servicio };
}

// Del 2 al 6 de noviembre: 18 días calendario de anticipación y 3 laborables.
const programada: CrearSolicitudEntrada = {
  fechaInicio: '2026-11-02',
  fechaFin: '2026-11-06',
};

describe('crear', () => {
  it('crea una solicitud programada con su numero de tramite, dias laborables y primer paso', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(1), programada);

    expect(solicitud).toMatchObject({
      ordenTramite: 'VAC-2026-000001',
      tipo: 'PROGRAMADA',
      estado: 'PENDIENTE',
      diasSolicitados: 3,
      fechaSolicitud: '2026-10-15',
      lugar: 'Flavio Alfaro',
      telefonoLocalizacion: '0990000000',
      justificacion: null,
    });
    expect(solicitud.solicitante.id).toBe(1);
  });

  it('asigna el primer paso al jefe inmediato con vencimiento a las 48 horas', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(1), programada);
    const [paso] = solicitud.pasos;

    expect(solicitud.pasos).toHaveLength(1);
    expect(paso).toMatchObject({
      orden: 1,
      tipoAprobador: 'JEFE_INMEDIATO',
      origen: 'RUTA',
      estado: 'PENDIENTE',
      aprobadorDisponible: true,
    });
    expect(paso?.aprobador.id).toBe(2);
    expect(paso?.venceAt).toEqual(new Date('2026-10-17T15:00:00Z'));
  });

  it('usa el plazo configurado por el hospital', async () => {
    const { servicio } = crearEscenario(24);
    const solicitud = await servicio.crear(actor(1), programada);

    expect(solicitud.pasos[0]?.venceAt).toEqual(new Date('2026-10-16T15:00:00Z'));
  });

  it('con menos de 3 dias de anticipacion exige justificacion', async () => {
    const { servicio } = crearEscenario();
    const entrada: CrearSolicitudEntrada = {
      fechaInicio: '2026-10-17',
      fechaFin: '2026-10-19',
    };

    await expect(servicio.crear(actor(1), entrada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });

    const solicitud = await servicio.crear(actor(1), {
      ...entrada,
      justificacion: 'Tramite personal urgente',
    });

    expect(solicitud).toMatchObject({
      tipo: 'NO_PROGRAMADA',
      diasSolicitados: 1,
      justificacion: 'Tramite personal urgente',
    });
  });

  it('con exactamente 3 dias de anticipacion es programada', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(1), {
      fechaInicio: '2026-10-18',
      fechaFin: '2026-10-19',
    });

    expect(solicitud.tipo).toBe('PROGRAMADA');
  });

  it('usa el telefono indicado en lugar del registrado', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(1), {
      ...programada,
      telefonoLocalizacion: '0981112223',
    });

    expect(solicitud.telefonoLocalizacion).toBe('0981112223');
  });

  it('rechaza una fecha de inicio anterior a hoy', async () => {
    const { servicio } = crearEscenario();

    await expect(
      servicio.crear(actor(1), {
        fechaInicio: '2026-10-14',
        fechaFin: '2026-10-16',
        justificacion: 'x',
      }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza un rango sin dias laborables por fines de semana o feriados', async () => {
    const { servicio } = crearEscenario();

    await expect(
      servicio.crear(actor(1), {
        fechaInicio: '2026-11-02',
        fechaFin: '2026-11-03',
      }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });

    await expect(
      servicio.crear(actor(1), {
        fechaInicio: '2026-11-07',
        fechaFin: '2026-11-08',
      }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('rechaza pedir mas dias que el saldo disponible', async () => {
    const { servicio, saldos } = crearEscenario();
    saldos.set(1, 2);

    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza a quien no tiene periodos de vacaciones', async () => {
    const { servicio, saldos } = crearEscenario();
    saldos.delete(1);

    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza una solicitud que se cruza con otra en tramite', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(actor(1), programada);

    await expect(
      servicio.crear(actor(1), {
        fechaInicio: '2026-11-05',
        fechaFin: '2026-11-10',
      }),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('permite pedir fechas contiguas que no se cruzan', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(actor(1), programada);

    await expect(
      servicio.crear(actor(1), {
        fechaInicio: '2026-11-09',
        fechaFin: '2026-11-10',
      }),
    ).resolves.toBeDefined();
  });

  it('el numero de tramite es correlativo por hospital', async () => {
    const { servicio, personas, saldos } = crearEscenario();

    personas.set(11, persona(11, { jefeInmediatoId: 2 }));
    saldos.set(11, 60);

    personas.set(30, persona(30, { empresaId: 6, jefeInmediatoId: 31 }));
    personas.set(31, persona(31, { empresaId: 6 }));
    saldos.set(30, 60);

    const primera = await servicio.crear(actor(1), programada);
    const segunda = await servicio.crear(actor(11), programada);
    const ajena = await servicio.crear(actor(30, 'EMPLEADO', 6), programada);

    expect(primera.ordenTramite).toBe('VAC-2026-000001');
    expect(segunda.ordenTramite).toBe('VAC-2026-000002');
    expect(ajena.ordenTramite).toBe('VAC-2026-000001');
  });

  it('asigna directamente al Rector si la persona no tiene jefe inmediato', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(8), programada);

    expect(solicitud.pasos).toHaveLength(1);
    expect(solicitud.pasos[0]).toMatchObject({
      orden: 1,
      tipoAprobador: 'AUTORIDAD_MAXIMA',
      estado: 'PENDIENTE',
      aprobador: { id: 4 },
    });
  });

  it('asigna directamente al Rector si el jefe inmediato esta inactivo', async () => {
    const { servicio, personas } = crearEscenario();
    const jefa = personas.get(2);

    if (jefa) jefa.estado = 'INACTIVO';

    const solicitud = await servicio.crear(actor(1), programada);

    expect(solicitud.pasos).toHaveLength(1);
    expect(solicitud.pasos[0]).toMatchObject({
      orden: 1,
      tipoAprobador: 'AUTORIDAD_MAXIMA',
      estado: 'PENDIENTE',
      aprobador: { id: 4 },
    });
  });

  it('rechaza a una persona dada de baja', async () => {
    const { servicio, personas } = crearEscenario();
    const luis = personas.get(1);

    if (luis) luis.estado = 'INACTIVO';

    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza la asignacion directa si no existe exactamente un Rector activo', async () => {
    const { servicio, aprobadores } = crearEscenario();
    aprobadores.autoridadMaxima = null;

    await expect(servicio.crear(actor(8), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('marca al aprobador como no disponible si tiene vacaciones hoy', async () => {
    const { servicio, ausentes } = crearEscenario();
    ausentes.add(2);

    const solicitud = await servicio.crear(actor(1), programada);

    expect(solicitud.pasos[0]).toMatchObject({
      estado: 'PENDIENTE',
      aprobadorDisponible: false,
    });
  });

  it('el subdirector solicita al Rector', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(3, 'JEFE_AREA'), programada);

    expect(solicitud.pasos[0]).toMatchObject({
      tipoAprobador: 'AUTORIDAD_MAXIMA',
    });
    expect(solicitud.pasos[0]?.aprobador.id).toBe(4);
  });

  it('la solicitud del Rector sigue la ruta especial del SUPERADMIN', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(4, 'JEFE_AREA'), programada);

    expect(solicitud.pasos[0]).toMatchObject({
      tipoAprobador: 'SUPERADMIN',
    });
    expect(solicitud.pasos[0]?.aprobador.id).toBe(7);
  });

  it('una jefa de area solicita a su jefe inmediato', async () => {
    const { servicio } = crearEscenario();
    const solicitud = await servicio.crear(actor(2, 'JEFE_AREA'), programada);

    expect(solicitud.pasos[0]?.aprobador.id).toBe(3);
  });

  it('rechaza si el hospital no tiene ruta para el nivel', async () => {
    const { servicio, rutas } = crearEscenario();
    rutas.delete(5);

    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('rechaza que alguien apruebe su propia solicitud', async () => {
    const { servicio, rutas, aprobadores } = crearEscenario();
    rutas.set(5, ['JEFE_AREA']);
    aprobadores.jefeArea.set(10, 1);

    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('no deja crear una solicitud si la persona no existe en el hospital', async () => {
    const { servicio } = crearEscenario();

    await expect(servicio.crear(actor(1, 'EMPLEADO', 6), programada)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('obtener', () => {
  it('el solicitante ve su solicitud', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(servicio.obtener(actor(1), creada.id)).resolves.toMatchObject({
      id: creada.id,
    });
  });

  it('su jefe aprobador, Talento Humano y SUPERADMIN tambien la ven', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(servicio.obtener(actor(2, 'JEFE_AREA'), creada.id)).resolves.toBeDefined();
    await expect(servicio.obtener(actor(50, 'TALENTO_HUMANO'), creada.id)).resolves.toBeDefined();
    await expect(servicio.obtener(actor(51, 'SUPERADMIN'), creada.id)).resolves.toBeDefined();
  });

  it('otro empleado o un jefe ajeno al tramite no la ve', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(servicio.obtener(actor(8), creada.id)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await expect(servicio.obtener(actor(9, 'JEFE_AREA'), creada.id)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('no se ve desde otro hospital ni si no existe', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(servicio.obtener(actor(50, 'TALENTO_HUMANO', 6), creada.id)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await expect(servicio.obtener(actor(1), 9999)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('listarPropias', () => {
  it('lista solo las solicitudes de la persona, mas recientes primero, y pagina', async () => {
    const { servicio } = crearEscenario();
    const primera = await servicio.crear(actor(1), programada);
    const segunda = await servicio.crear(actor(1), {
      fechaInicio: '2026-11-09',
      fechaFin: '2026-11-10',
    });

    const pagina = await servicio.listarPropias(actor(1), {
      pagina: 1,
      porPagina: 1,
    });

    expect(pagina).toMatchObject({ total: 2, pagina: 1, porPagina: 1 });
    expect(pagina.solicitudes.map((s) => s.id)).toEqual([segunda.id]);

    const resto = await servicio.listarPropias(actor(1), {
      pagina: 2,
      porPagina: 1,
    });

    expect(resto.solicitudes.map((s) => s.id)).toEqual([primera.id]);
  });

  it('filtra por estado y no mezcla personas', async () => {
    const { servicio } = crearEscenario();
    await servicio.crear(actor(1), programada);

    const vacia = await servicio.listarPropias(actor(1), {
      estado: 'AUTORIZADA',
      pagina: 1,
      porPagina: 20,
    });

    expect(vacia).toMatchObject({ total: 0, solicitudes: [] });

    const deOtro = await servicio.listarPropias(actor(2, 'JEFE_AREA'), {
      pagina: 1,
      porPagina: 20,
    });

    expect(deOtro.total).toBe(0);
  });
});

describe('procesarEscalamientosVencidos', () => {
  it('escala del jefe inmediato al Rector y no duplica el escalamiento', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes } = crearEscenario(1, () => ahora);
    const solicitud = await servicio.crear(actor(1), programada);

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(1);

    const pasos = solicitudes[0]?.detalle.pasos;

    expect(pasos).toHaveLength(2);
    expect(pasos?.[0]).toMatchObject({
      tipoAprobador: 'JEFE_INMEDIATO',
      estado: 'ESCALADO',
    });
    expect(pasos?.[1]).toMatchObject({
      orden: 2,
      tipoAprobador: 'AUTORIDAD_MAXIMA',
      origen: 'ESCALAMIENTO_PLAZO',
      estado: 'PENDIENTE',
      aprobador: { id: 4 },
      venceAt: new Date(ahora.getTime() + 60 * 60 * 1000),
    });

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);

    expect(solicitud.id).toBe(solicitudes[0]?.detalle.id);
    expect(solicitudes[0]?.detalle.pasos).toHaveLength(2);
  });

  it('escala del Rector al SUPERADMIN cuando vence su propio plazo', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes } = crearEscenario(1, () => ahora);

    await servicio.crear(actor(1), programada);

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);
    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(1);

    ahora = new Date(ahora.getTime() + 60 * 60 * 1000);
    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(1);

    const pasos = solicitudes[0]?.detalle.pasos;

    expect(pasos).toHaveLength(3);
    expect(pasos?.[0]?.estado).toBe('ESCALADO');
    expect(pasos?.[1]).toMatchObject({
      tipoAprobador: 'AUTORIDAD_MAXIMA',
      estado: 'ESCALADO',
    });
    expect(pasos?.[2]).toMatchObject({
      tipoAprobador: 'SUPERADMIN',
      origen: 'ESCALAMIENTO_PLAZO',
      estado: 'PENDIENTE',
      aprobador: { id: 7 },
      venceAt: new Date(ahora.getTime() + 60 * 60 * 1000),
    });
  });

  it('mantiene pendiente el paso vencido si no existe un Rector activo para escalar', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes, aprobadores } = crearEscenario(1, () => ahora);
    aprobadores.autoridadMaxima = null;

    await servicio.crear(actor(1), programada);

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);

    expect(solicitudes[0]?.detalle.estado).toBe('PENDIENTE');
    expect(solicitudes[0]?.detalle.pasos).toHaveLength(1);
    expect(solicitudes[0]?.detalle.pasos[0]).toMatchObject({
      tipoAprobador: 'JEFE_INMEDIATO',
      estado: 'PENDIENTE',
      aprobador: { id: 2 },
    });
  });

  it('autoriza la solicitud cuando el Rector acepta un paso escalado por vencimiento', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes, notificaciones } = crearEscenario(1, () => ahora);
    const solicitud = await servicio.crear(actor(1), programada);

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);
    await servicio.procesarEscalamientosVencidos();

    const detalle = await servicio.aprobar(actor(4), solicitud.id, {});

    expect(detalle.estado).toBe('AUTORIZADA');
    expect(solicitudes[0]?.detalle.pasos[0]?.estado).toBe('ESCALADO');
    expect(solicitudes[0]?.detalle.pasos[1]).toMatchObject({
      tipoAprobador: 'AUTORIDAD_MAXIMA',
      origen: 'ESCALAMIENTO_PLAZO',
      estado: 'APROBADO',
      decididoPor: { id: 4 },
    });
    expect(notificaciones).toContainEqual(
      expect.objectContaining({
        usuarioId: 1,
        tipo: 'SOLICITUD_APROBADA',
        referenciaId: solicitud.id,
      }),
    );
  });
});

// -----------------------------------------------------------------------------
// Cobertura adicional: cancelación, validación de decisiones y ruta intermedia.
// -----------------------------------------------------------------------------

describe('cancelar', () => {
  it('permite al solicitante cancelar su solicitud pendiente', async () => {
    const { servicio, solicitudes } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    const detalle = await servicio.cancelar(actor(1), creada.id, {});

    expect(detalle.estado).toBe('CANCELADA');
    expect(detalle.pasos[0]).toMatchObject({
      estado: 'CANCELADO',
      decididoPor: { id: 1 },
    });
    expect(solicitudes[0]?.detalle.motivoResolucion).toBeNull();
  });

  it('conserva el motivo indicado al cancelar', async () => {
    const { servicio, solicitudes } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    const detalle = await servicio.cancelar(actor(1), creada.id, {
      motivo: 'Cambio de planes personales',
    });

    expect(detalle.estado).toBe('CANCELADA');
    expect(solicitudes[0]?.detalle.motivoResolucion).toBe(
      'Cambio de planes personales',
    );
  });

  it('no permite cancelar una solicitud que el actor no puede ver', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(
      servicio.cancelar(actor(8), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('no permite que un aprobador cancele la solicitud de otra persona', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(
      servicio.cancelar(actor(2, 'JEFE_AREA'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'PROHIBIDO' });
  });

  it('no permite cancelar una solicitud que ya no está pendiente', async () => {
    const { servicio, solicitudes } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);
    const guardada = solicitudes[0];

    if (guardada) guardada.detalle.estado = 'VISTO_BUENO';

    await expect(
      servicio.cancelar(actor(1), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });
});

describe('validaciones para decidir', () => {
  it('oculta una solicitud a quien no tiene permiso para verla', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(
      servicio.aprobar(actor(8), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('rechaza decidir una solicitud que ya fue resuelta', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await servicio.aprobar(actor(2, 'JEFE_AREA'), creada.id, {});

    await expect(
      servicio.aprobar(actor(2, 'JEFE_AREA'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza decidir una solicitud sin paso pendiente', async () => {
    const { servicio, solicitudes } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);
    const guardada = solicitudes[0];

    if (guardada) {
      guardada.detalle.estado = 'VISTO_BUENO';
      const paso = guardada.detalle.pasos[0];
      if (paso) paso.estado = 'APROBADO';
    }

    await expect(
      servicio.aprobar(actor(2, 'JEFE_AREA'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza decidir cuando el actor puede ver la solicitud pero no es su aprobador', async () => {
    const { servicio } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    await expect(
      servicio.aprobar(actor(50, 'TALENTO_HUMANO'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'PROHIBIDO' });
  });
});

describe('aprobacion intermedia', () => {
  it('asigna el siguiente paso de la ruta con su propio plazo', async () => {
    const { servicio, rutas, aprobadores } = crearEscenario(24);
    rutas.set(5, ['JEFE_INMEDIATO', 'JEFE_AREA']);
    aprobadores.jefeArea.set(10, 9);

    const creada = await servicio.crear(actor(1), programada);

    const solicitud = await servicio.aprobar(
      actor(2, 'JEFE_AREA'),
      creada.id,
      {},
    );

    expect(solicitud.estado).toBe('VISTO_BUENO');
    expect(solicitud.pasos).toHaveLength(2);
    expect(solicitud.pasos[0]).toMatchObject({
      estado: 'APROBADO',
      decididoPor: { id: 2 },
    });
    expect(solicitud.pasos[1]).toMatchObject({
      orden: 2,
      tipoAprobador: 'JEFE_AREA',
      origen: 'RUTA',
      estado: 'PENDIENTE',
      aprobador: { id: 9 },
      venceAt: new Date('2026-10-16T15:00:00Z'),
    });
  });

  it('rechaza abrir el siguiente paso si no existe un aprobador configurado', async () => {
    const { servicio, rutas } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    rutas.set(5, ['JEFE_INMEDIATO', 'JEFE_AREA']);

    await expect(
      servicio.aprobar(actor(2, 'JEFE_AREA'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('impide asignar el siguiente paso al propio solicitante', async () => {
    const { servicio, rutas, aprobadores } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    rutas.set(5, ['JEFE_INMEDIATO', 'JEFE_AREA']);
    aprobadores.jefeArea.set(10, 1);

    await expect(
      servicio.aprobar(actor(2, 'JEFE_AREA'), creada.id, {}),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });
});

// -----------------------------------------------------------------------------
// Cobertura adicional: negación de solicitudes y notificaciones.
// -----------------------------------------------------------------------------

describe('negar', () => {
  it('niega la solicitud sin motivo y notifica al solicitante', async () => {
    const { servicio, solicitudes, notificaciones } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    const detalle = await servicio.negar(actor(2), creada.id, {});

    expect(detalle.estado).toBe('NEGADA');
    expect(detalle.motivoResolucion).toBeNull();
    expect(detalle.pasos[0]).toMatchObject({
      estado: 'NEGADO',
      decididoPor: { id: 2 },
      motivo: null,
    });
    expect(solicitudes[0]?.detalle.estado).toBe('NEGADA');
    expect(notificaciones).toContainEqual(
      expect.objectContaining({
        empresaId: 5,
        usuarioId: 1,
        tipo: 'SOLICITUD_NEGADA',
        referenciaId: creada.id,
        mensaje: 'Tu solicitud de Vacaciones fue negada por tu jefe.',
      }),
    );
  });

  it('conserva el motivo de negación y lo incluye en la notificación', async () => {
    const { servicio, notificaciones } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);
    const motivo = 'No es posible autorizar las fechas solicitadas.';

    const detalle = await servicio.negar(actor(2), creada.id, { motivo });

    expect(detalle.estado).toBe('NEGADA');
    expect(detalle.motivoResolucion).toBe(motivo);
    expect(detalle.pasos[0]?.motivo).toBe(motivo);
    expect(notificaciones).toContainEqual(
      expect.objectContaining({
        usuarioId: 1,
        tipo: 'SOLICITUD_NEGADA',
        mensaje: `Tu solicitud de Vacaciones fue negada por tu jefe. Motivo: ${motivo}`,
      }),
    );
  });

  it('limita a 200 caracteres el motivo incluido en la notificación', async () => {
    const { servicio, notificaciones } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);
    const motivo = 'M'.repeat(250);

    const detalle = await servicio.negar(actor(2), creada.id, { motivo });

    const notificacion = notificaciones.find(
      (elemento) => elemento.referenciaId === creada.id,
    );

    expect(detalle.motivoResolucion).toBe(motivo);
    expect(notificacion?.mensaje).toBe(
      `Tu solicitud de Vacaciones fue negada por tu jefe. Motivo: ${motivo.slice(0, 200)}`,
    );

  });
});

// -----------------------------------------------------------------------------
// Cobertura adicional: ramas pendientes de vacaciones.service.
// -----------------------------------------------------------------------------

describe('ramas pendientes de vacaciones.service', () => {
  it('rechaza operar cuando no existe configuración institucional', async () => {
    const memoria = crearVacacionesEnMemoria();
    const servicio = new VacacionesService({
      repositorio: memoria.repositorio,
      calcularDiasLaborables: contarDiasLaborablesDePrueba,
      obtenerConfiguracionInstitucional: () => Promise.resolve(null as never),
      ahora: () => AHORA,
    });

    await expect(
      servicio.crear(actor(1), programada),
    ).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('omite el escalamiento cuando el paso vencido pertenece a SUPERADMIN', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes, repositorio } = crearEscenario(1, () => ahora);
    const creada = await servicio.crear(actor(1), programada);

    const listarOriginal = repositorio.listarPasosVencidos.bind(repositorio);
    const listarSpy = vi.spyOn(repositorio, 'listarPasosVencidos')
      .mockResolvedValue([{
        empresaId: 5,
        solicitudId: creada.id,
        pasoId: solicitudes[0]!.detalle.pasos[0]!.id,
        orden: 1,
        tipoAprobador: 'SUPERADMIN',
        solicitanteId: 1,
      }]);

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);
    expect(listarSpy).toHaveBeenCalled();
    expect(solicitudes[0]?.detalle.pasos).toHaveLength(1);

    listarSpy.mockRestore();
    void listarOriginal;
  });

  it('omite el escalamiento cuando el solicitante ya no existe', async () => {
    let ahora = AHORA;
    const { servicio, personas, solicitudes } = crearEscenario(1, () => ahora);
    await servicio.crear(actor(1), programada);

    personas.delete(1);
    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);
    expect(solicitudes[0]?.detalle.pasos).toHaveLength(1);
    expect(solicitudes[0]?.detalle.pasos[0]?.estado).toBe('PENDIENTE');
  });

  it('omite el escalamiento cuando se agota el orden máximo de aprobación', async () => {
    let ahora = AHORA;
    const { servicio, solicitudes } = crearEscenario(1, () => ahora);
    await servicio.crear(actor(1), programada);

    solicitudes[0]!.detalle.pasos[0]!.orden = 255;
    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);
    expect(solicitudes[0]?.detalle.pasos).toHaveLength(1);
    expect(solicitudes[0]?.detalle.pasos[0]?.estado).toBe('PENDIENTE');
  });

  it('continúa procesando si ocurre un error Error durante un escalamiento', async () => {
    let ahora = AHORA;
    const { servicio, repositorio } = crearEscenario(1, () => ahora);
    await servicio.crear(actor(1), programada);

    const resolverSpy = vi.spyOn(repositorio, 'resolverAprobador')
      .mockRejectedValueOnce(new Error('Fallo de prueba'));

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);
    expect(resolverSpy).toHaveBeenCalledOnce();

    resolverSpy.mockRestore();
  });

  it('convierte a texto los errores no estándar durante un escalamiento', async () => {
    let ahora = AHORA;
    const { servicio, repositorio } = crearEscenario(1, () => ahora);
    await servicio.crear(actor(1), programada);

    const resolverSpy = vi.spyOn(repositorio, 'resolverAprobador')
      .mockRejectedValueOnce('Fallo no estándar');

    ahora = new Date(AHORA.getTime() + 60 * 60 * 1000);

    await expect(servicio.procesarEscalamientosVencidos()).resolves.toBe(0);
    expect(resolverSpy).toHaveBeenCalledOnce();

    resolverSpy.mockRestore();
  });

  it('rechaza aprobar cuando el solicitante ya no existe', async () => {
    const { servicio, personas } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);

    personas.delete(1);

    await expect(
      servicio.aprobar(actor(2), creada.id, {}),
    ).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

// -----------------------------------------------------------------------------
// Cobertura adicional: reloj predeterminado, periodos y visibilidad del decisor.
// -----------------------------------------------------------------------------

describe('ramas opcionales de vacaciones.service', () => {
  it('utiliza el reloj del sistema cuando no se inyecta ahora', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);

    try {
      const { servicio } = crearEscenario(48, null);
      const solicitud = await servicio.crear(actor(1), programada);

      expect(solicitud.fechaSolicitud).toBe('2026-10-15');
      expect(solicitud.pasos[0]?.venceAt).toEqual(
        new Date('2026-10-17T15:00:00Z'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('ejecuta asegurarPeriodos cuando la dependencia está disponible', async () => {
    const asegurarPeriodos = vi.fn(() => Promise.resolve());
    const { servicio } = crearEscenario(48, () => AHORA, asegurarPeriodos);

    await servicio.crear(actor(1), programada);

    expect(asegurarPeriodos).toHaveBeenCalledOnce();
    expect(asegurarPeriodos).toHaveBeenCalledWith(
      5,
      1,
      expect.anything(),
    );
  });

  it('permite ver la solicitud a quien decidió un paso aunque no sea su aprobador actual', async () => {
    const { servicio, solicitudes } = crearEscenario();
    const creada = await servicio.crear(actor(1), programada);
    const paso = solicitudes[0]!.detalle.pasos[0]!;

    paso.decididoPor = { ...paso.aprobador, id: 2 };
    paso.aprobador.id = 9;

    await expect(
      servicio.obtener(actor(2), creada.id),
    ).resolves.toMatchObject({ id: creada.id });
  });
});