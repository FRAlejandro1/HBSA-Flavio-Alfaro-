// Pruebas unitarias del repositorio de vacaciones.
// Verifica consultas tenant-aware, aprobadores, transacciones, saldos y decisiones.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos, IConexionBD } from '../../../../src/config/database';
import { VacacionesRepository } from '../../../../src/modules/vacaciones/vacaciones.repository';
import type {
  DatosAprobacionIntermedia,
  DatosCancelacion,
  DatosEscalamientoPlazo,
  DatosNuevaSolicitud,
  DatosResolucionFinal,
  FiltrosSolicitudes,
  Solicitante,
} from '../../../../src/modules/vacaciones/vacaciones.dominio';

const consultar = vi.fn();
const ejecutar = vi.fn();
const transaccion = vi.fn();

const consultarTx = vi.fn();
const ejecutarTx = vi.fn();

const bd = { consultar, ejecutar, transaccion } as unknown as IBaseDatos;
const tx = {
  consultar: consultarTx,
  ejecutar: ejecutarTx,
} as unknown as IConexionBD;

const repositorio = new VacacionesRepository(bd);

const ahora = new Date('2026-11-04T15:00:00.000Z');
const asignadoAt = new Date('2026-11-04T14:00:00.000Z');
const venceAt = new Date('2026-11-06T14:00:00.000Z');

const solicitante: Solicitante = {
  id: 10,
  areaId: 2,
  cargoId: 3,
  nivelJerarquico: 4,
  telefono: '0991234567',
  jefeInmediatoId: 20,
  estado: 'ACTIVO',
  lugar: 'Flavio Alfaro',
};

const datosDecision = {
  solicitudId: 30,
  pasoId: 40,
  aprobadorId: 20,
  decididoPorId: 21,
  delegacionId: 50,
  decididoAt: ahora,
  motivo: 'Revisado',
};

const notificacion = {
  usuarioId: 10,
  tipo: 'SOLICITUD_APROBADA' as const,
  mensaje: 'Su solicitud fue aprobada',
};

const datosFinal: DatosResolucionFinal = {
  ...datosDecision,
  notificacion,
};

const datosIntermedios: DatosAprobacionIntermedia = {
  ...datosDecision,
  siguiente: {
    orden: 2,
    tipoAprobador: 'JEFE_AREA',
    aprobadorId: 22,
    asignadoAt: ahora,
    venceAt,
  },
};

const datosNueva: DatosNuevaSolicitud = {
  usuarioId: 10,
  areaId: 2,
  cargoId: 3,
  lugar: 'Flavio Alfaro',
  telefonoLocalizacion: null,
  solicitadoAt: ahora,
  fechaSolicitud: '2026-11-04',
  diasAnticipacionAplicada: 3,
  fechaInicio: '2026-12-01',
  fechaFin: '2026-12-03',
  diasSolicitados: 3,
  justificacion: 'Asunto personal',
  primerPaso: {
    tipoAprobador: 'JEFE_INMEDIATO',
    aprobadorId: 20,
    asignadoAt: ahora,
    venceAt,
  },
};

const filaSolicitud = {
  id: 30,
  ordenTramite: 'VAC-2026-000001',
  usuarioId: 10,
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Pérez',
  areaId: 2,
  areaDetalle: 'Emergencia',
  cargoId: 3,
  cargoDetalle: 'Enfermera',
  lugar: 'Flavio Alfaro',
  telefonoLocalizacion: null,
  solicitadoAt: ahora,
  fechaSolicitud: '2026-11-04',
  fechaInicio: '2026-12-01',
  fechaFin: '2026-12-03',
  diasSolicitados: '3.00',
  justificacion: 'Asunto personal',
  tipo: 'PROGRAMADA' as const,
  estado: 'PENDIENTE' as const,
  motivoResolucion: null,
  fechaResolucion: null,
};

const filaPaso = {
  id: 40,
  orden: 1,
  tipoAprobador: 'JEFE_INMEDIATO' as const,
  origen: 'RUTA' as const,
  estado: 'PENDIENTE' as const,
  motivo: null,
  asignadoAt,
  venceAt,
  decididoAt: null,
  aprobadorId: 20,
  aprobadorNombres: 'Luis',
  aprobadorApellidos: 'Mena',
  aprobadorDisponible: 1,
  decididoPorId: null,
  decididoPorNombres: null,
  decididoPorApellidos: null,
};

const solicitudBloqueada = {
  estado: 'PENDIENTE' as const,
  usuarioId: 10,
  fechaInicio: '2026-12-01',
  diasSolicitados: '3.00',
};

const pasoBloqueado = {
  estado: 'PENDIENTE' as const,
  aprobadorId: 20,
};

function obtenerLlamada<T extends readonly unknown[]>(
  llamadas: readonly T[],
  indice: number,
): T {
  const llamada = llamadas[indice];

  if (llamada === undefined) {
    throw new Error(`No existe la llamada al mock en la posición ${indice}`);
  }

  return llamada;
}

type LlamadaEjecutar = readonly [
  sql: string,
  valores?: readonly unknown[],
];

function obtenerLlamadaEjecutar(indice: number): LlamadaEjecutar {
  const llamada = ejecutarTx.mock.calls[indice] as unknown as
    | LlamadaEjecutar
    | undefined;

  if (llamada === undefined) {
    throw new Error(`No existe la llamada al mock en la posición ${indice}`);
  }

  return llamada;
}

function obtenerLlamadasEjecutar(): readonly LlamadaEjecutar[] {
  return ejecutarTx.mock.calls as unknown as readonly LlamadaEjecutar[];
}

beforeEach(() => {
  vi.clearAllMocks();

  transaccion.mockImplementation(
    (trabajo: (conexion: IConexionBD) => Promise<unknown>) => trabajo(tx),
  );
});

describe('buscarSolicitante', () => {
  it('devuelve los datos del solicitante y filtra por hospital y usuario', async () => {
    consultar.mockResolvedValueOnce([solicitante]);

    await expect(repositorio.buscarSolicitante(7, 10)).resolves.toEqual(solicitante);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('u.empresa_id = ? AND u.id = ?');
  });

  it('devuelve null cuando no encuentra al solicitante', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.buscarSolicitante(7, 99)).resolves.toBeNull();
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo solicitante'));

    await expect(repositorio.buscarSolicitante(7, 10)).rejects.toThrow('Fallo solicitante');
  });
});

describe('listarRuta', () => {
  it('devuelve los tipos de aprobador ordenados', async () => {
    consultar.mockResolvedValueOnce([
      { tipoAprobador: 'JEFE_INMEDIATO' },
      { tipoAprobador: 'JEFE_AREA' },
    ]);

    await expect(repositorio.listarRuta(7, 4)).resolves.toEqual([
      'JEFE_INMEDIATO',
      'JEFE_AREA',
    ]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 4]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('ORDER BY orden');
  });

  it('devuelve una lista vacía cuando no hay ruta', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.listarRuta(7, 4)).resolves.toEqual([]);
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo ruta'));

    await expect(repositorio.listarRuta(7, 4)).rejects.toThrow('Fallo ruta');
  });
});

describe('resolverAprobador', () => {
  it('resuelve al jefe inmediato activo', async () => {
    consultar.mockResolvedValueOnce([{ id: 20 }]);

    await expect(
      repositorio.resolverAprobador(7, 'JEFE_INMEDIATO', solicitante),
    ).resolves.toBe(20);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 20]);
  });

  it('no consulta cuando el solicitante no tiene jefe inmediato', async () => {
    await expect(
      repositorio.resolverAprobador(7, 'JEFE_INMEDIATO', {
        ...solicitante,
        jefeInmediatoId: null,
      }),
    ).resolves.toBeNull();

    expect(consultar).not.toHaveBeenCalled();
  });

  it('devuelve null si el jefe inmediato no está activo', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.resolverAprobador(7, 'JEFE_INMEDIATO', solicitante),
    ).resolves.toBeNull();
  });

  it('resuelve al jefe de área activo', async () => {
    consultar.mockResolvedValueOnce([{ id: 25 }]);

    await expect(
      repositorio.resolverAprobador(7, 'JEFE_AREA', solicitante),
    ).resolves.toBe(25);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 2]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain("u.estado = 'ACTIVO'");
  });

  it('devuelve null cuando el área no tiene jefe activo', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.resolverAprobador(7, 'JEFE_AREA', solicitante),
    ).resolves.toBeNull();
  });

  it('resuelve la autoridad máxima cuando existe exactamente un cargo de nivel uno activo', async () => {
    consultar.mockResolvedValueOnce([{ id: 1 }]);

    await expect(
      repositorio.resolverAprobador(7, 'AUTORIDAD_MAXIMA', solicitante),
    ).resolves.toBe(1);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('c.nivel_jerarquico = 1');
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).not.toContain("r.codigo = 'AUTORIDAD_MAXIMA'");
  });

  it('devuelve null si no existe una autoridad máxima activa', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.resolverAprobador(7, 'AUTORIDAD_MAXIMA', solicitante),
    ).resolves.toBeNull();
  });

  it('devuelve null si existen varias autoridades máximas activas', async () => {
    consultar.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    await expect(
      repositorio.resolverAprobador(7, 'AUTORIDAD_MAXIMA', solicitante),
    ).resolves.toBeNull();
  });

  it('resuelve al primer SUPERADMIN activo', async () => {
    consultar.mockResolvedValueOnce([{ id: 90 }]);

    await expect(
      repositorio.resolverAprobador(7, 'SUPERADMIN', solicitante),
    ).resolves.toBe(90);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain("r.codigo = 'SUPERADMIN'");
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7]);
  });

  it('devuelve null si no existe SUPERADMIN activo', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.resolverAprobador(7, 'SUPERADMIN', solicitante),
    ).resolves.toBeNull();
  });

  it('propaga errores de consulta al resolver', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo aprobador'));

    await expect(
      repositorio.resolverAprobador(7, 'JEFE_AREA', solicitante),
    ).rejects.toThrow('Fallo aprobador');
  });
});

describe('listarPasosVencidos', () => {
  it('lista los pasos vencidos y conserva la fecha recibida', async () => {
    const pasos = [{
      empresaId: 7,
      solicitudId: 30,
      pasoId: 40,
      orden: 1,
      tipoAprobador: 'JEFE_AREA',
      solicitanteId: 10,
    }];
    consultar.mockResolvedValueOnce(pasos);

    await expect(repositorio.listarPasosVencidos(ahora, 25)).resolves.toEqual(pasos);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([ahora]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain("p.estado = 'PENDIENTE'");
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain("p.tipo_aprobador <> 'SUPERADMIN'");
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 25');
  });

  it('limita el máximo de resultados a 500', async () => {
    consultar.mockResolvedValueOnce([]);

    await repositorio.listarPasosVencidos(ahora, 900);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 500');
  });

  it('limita el mínimo de resultados a uno', async () => {
    consultar.mockResolvedValueOnce([]);

    await repositorio.listarPasosVencidos(ahora, 0);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 1');
  });

  it('trunca el límite decimal', async () => {
    consultar.mockResolvedValueOnce([]);

    await repositorio.listarPasosVencidos(ahora, 12.8);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 12');
  });

  it('usa el límite predeterminado cuando recibe un valor no finito', async () => {
    consultar.mockResolvedValueOnce([]);

    await repositorio.listarPasosVencidos(ahora, Number.NaN);

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 100');
  });
});

describe('escalarPasoVencido', () => {
  const datos: DatosEscalamientoPlazo = {
    solicitudId: 30,
    pasoId: 40,
    nuevoTipoAprobador: 'AUTORIDAD_MAXIMA',
    nuevoAprobadorId: 1,
    nuevaOrden: 2,
    escaladoAt: ahora,
    nuevaVenceAt: venceAt,
    motivo: 'Escalamiento por vencimiento',
  };

  it('marca el paso vencido y crea el siguiente paso en una transacción', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([{
        estado: 'PENDIENTE',
        tipoAprobador: 'JEFE_AREA',
        venceAt: new Date('2026-11-03T15:00:00.000Z'),
      }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(true);

    expect(transaccion).toHaveBeenCalledOnce();
    expect(ejecutarTx).toHaveBeenCalledTimes(2);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[0]).toContain("estado = 'ESCALADO'");
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([
      ahora, datos.motivo, 7, 30, 40,
    ]);
    expect(obtenerLlamadaEjecutar(1)[0]).toContain("'ESCALAMIENTO_PLAZO'");
    expect(obtenerLlamadaEjecutar(1)[1]).toEqual([
      7, 30, 2, 'AUTORIDAD_MAXIMA', 1, 40,
      datos.motivo, ahora, venceAt,
    ]);
  });

  it('no escala si la solicitud no existe', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('no escala si la solicitud ya fue resuelta', async () => {
    consultarTx.mockResolvedValueOnce([{ estado: 'AUTORIZADA' }]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
    expect(consultarTx).toHaveBeenCalledOnce();
  });

  it('no escala si el paso no existe', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
  });

  it('no escala si el paso ya no está pendiente', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([{
        estado: 'APROBADO',
        tipoAprobador: 'JEFE_AREA',
        venceAt: new Date('2026-11-03T15:00:00.000Z'),
      }]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
  });

  it('no vuelve a escalar un paso de SUPERADMIN', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([{
        estado: 'PENDIENTE',
        tipoAprobador: 'SUPERADMIN',
        venceAt: new Date('2026-11-03T15:00:00.000Z'),
      }]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
  });

  it('no escala un paso sin vencimiento', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([{
        estado: 'PENDIENTE',
        tipoAprobador: 'JEFE_AREA',
        venceAt: null,
      }]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
  });

  it('no escala antes del vencimiento', async () => {
    consultarTx
      .mockResolvedValueOnce([{ estado: 'PENDIENTE' }])
      .mockResolvedValueOnce([{
        estado: 'PENDIENTE',
        tipoAprobador: 'JEFE_AREA',
        venceAt: venceAt,
      }]);

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).resolves.toBe(false);
  });

  it('traduce errores de duplicidad al escalar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Ya existe una solicitud con ese numero de tramite',
    });
  });

  it('traduce referencias inválidas al escalar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'La persona, el area, el cargo o el aprobador indicado no existe en este hospital',
    });
  });

  it('propaga errores inesperados al escalar', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo escalamiento'));

    await expect(repositorio.escalarPasoVencido(7, datos, ahora)).rejects.toThrow(
      'Fallo escalamiento',
    );
  });
});

describe('feriadosEntre', () => {
  it('devuelve las fechas ordenadas por la consulta', async () => {
    consultar.mockResolvedValueOnce([
      { fecha: '2026-12-25' },
      { fecha: '2026-12-31' },
    ]);

    await expect(
      repositorio.feriadosEntre('2026-12-01', '2026-12-31'),
    ).resolves.toEqual(['2026-12-25', '2026-12-31']);

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual(['2026-12-01', '2026-12-31']);
  });

  it('devuelve lista vacía cuando no hay feriados', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.feriadosEntre('2026-01-01', '2026-01-02')).resolves.toEqual([]);
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo feriados'));

    await expect(repositorio.feriadosEntre('2026-01-01', '2026-01-02')).rejects.toThrow(
      'Fallo feriados',
    );
  });
});

describe('existeSolapamiento', () => {
  it('devuelve true cuando encuentra una solicitud que ocupa las fechas', async () => {
    consultar.mockResolvedValueOnce([{ uno: 1 }]);

    await expect(
      repositorio.existeSolapamiento(7, 10, '2026-12-01', '2026-12-03'),
    ).resolves.toBe(true);

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10, '2026-12-03', '2026-12-01']);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain("'AUTORIZADA'");
  });

  it('devuelve false cuando no hay solapamiento', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(
      repositorio.existeSolapamiento(7, 10, '2026-12-01', '2026-12-03'),
    ).resolves.toBe(false);
  });

  it('propaga errores de consulta', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo solapamiento'));

    await expect(
      repositorio.existeSolapamiento(7, 10, '2026-12-01', '2026-12-03'),
    ).rejects.toThrow('Fallo solapamiento');
  });
});

describe('saldoDisponible', () => {
  it('convierte el saldo decimal recibido como texto', async () => {
    consultar.mockResolvedValueOnce([{ saldo: '12.75' }]);

    await expect(repositorio.saldoDisponible(7, 10, '2026-12-01')).resolves.toBe(12.75);
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10, '2026-12-01', '2026-12-01', 7, 10]);
  });

  it('conserva los saldos numéricos', async () => {
    consultar.mockResolvedValueOnce([{ saldo: 8 }]);

    await expect(repositorio.saldoDisponible(7, 10, '2026-12-01')).resolves.toBe(8);
  });

  it('limita a cero un saldo negativo', async () => {
    consultar.mockResolvedValueOnce([{ saldo: '-2.5' }]);

    await expect(repositorio.saldoDisponible(7, 10, '2026-12-01')).resolves.toBe(0);
  });

  it('usa cero cuando la consulta no devuelve fila', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.saldoDisponible(7, 10, '2026-12-01')).resolves.toBe(0);
  });

  it('usa cero cuando el saldo es null', async () => {
    consultar.mockResolvedValueOnce([{ saldo: null }]);

    await expect(repositorio.saldoDisponible(7, 10, '2026-12-01')).resolves.toBe(0);
  });
});

describe('registrarSolicitud', () => {
  it('registra solicitud, secuencia y primer paso dentro de una transacción', async () => {
    consultarTx
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ saldo: '10.00' }]);
    ejecutarTx
      .mockResolvedValueOnce({ idInsertado: 4, filasAfectadas: 1 })
      .mockResolvedValueOnce({ idInsertado: 30, filasAfectadas: 1 })
      .mockResolvedValueOnce({ idInsertado: 40, filasAfectadas: 1 });

    await expect(repositorio.registrarSolicitud(7, datosNueva)).resolves.toBe(30);

    expect(transaccion).toHaveBeenCalledOnce();
    expect(obtenerLlamada(consultarTx.mock.calls, 0)[0]).toContain('usuarios');
    expect(obtenerLlamada(consultarTx.mock.calls, 0)[0]).toContain('FOR UPDATE');
    expect(ejecutarTx).toHaveBeenCalledTimes(3);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([7, 2026]);
    expect(obtenerLlamadaEjecutar(1)[0]).toContain('dias_anticipacion_aplicada');
    expect(obtenerLlamadaEjecutar(1)[1]).toContain(3);
    expect(obtenerLlamadaEjecutar(2)[1]).toEqual([
      7, 30, 'JEFE_INMEDIATO', 20, ahora, venceAt,
    ]);
  });

  it('rechaza el registro cuando existe solapamiento', async () => {
    consultarTx
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([{ uno: 1 }]);

    await expect(repositorio.registrarSolicitud(7, datosNueva)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Ya tienes una solicitud de vacaciones en esas fechas',
    });

    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('rechaza el registro cuando el saldo es insuficiente', async () => {
    consultarTx
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ saldo: '2.00' }]);

    await expect(repositorio.registrarSolicitud(7, datosNueva)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'Tu saldo disponible es de 2 dias y solicitas 3',
    });

    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('construye el número de trámite con ceros a la izquierda', async () => {
    consultarTx
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ saldo: 10 }]);
    ejecutarTx
      .mockResolvedValueOnce({ idInsertado: 7, filasAfectadas: 1 })
      .mockResolvedValueOnce({ idInsertado: 30, filasAfectadas: 1 })
      .mockResolvedValueOnce({ idInsertado: 40, filasAfectadas: 1 });

    await repositorio.registrarSolicitud(7, datosNueva);

    expect(obtenerLlamadaEjecutar(1)[1]).toContain('VAC-2026-000007');
  });

  it('traduce duplicidad al registrar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(repositorio.registrarSolicitud(7, datosNueva)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Ya existe una solicitud con ese numero de tramite',
    });
  });

  it('traduce referencias inválidas al registrar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.registrarSolicitud(7, datosNueva)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('propaga errores inesperados al registrar', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo registro'));

    await expect(repositorio.registrarSolicitud(7, datosNueva)).rejects.toThrow('Fallo registro');
  });
});

describe('aprobarPasoIntermedio', () => {
  it('aprueba el paso actual y abre el siguiente', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.aprobarPasoIntermedio(7, datosIntermedios)).resolves.toBeUndefined();

    expect(ejecutarTx).toHaveBeenCalledTimes(3);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[0]).toContain('SET estado = ?');
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([
      'APROBADO', 20, ahora, 'Revisado', 7, 40,
    ]);
    expect(obtenerLlamadaEjecutar(1)[0]).toContain("estado = 'VISTO_BUENO'");
    expect(obtenerLlamada(ejecutarTx.mock.calls, 2)[0]).toContain("'RUTA'");
    expect(obtenerLlamadaEjecutar(2)[1]).toEqual([
      7, 30, 2, 'JEFE_AREA', 22, ahora, venceAt,
    ]);
  });

  it('rechaza una solicitud inexistente', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });

    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('rechaza una solicitud que ya no está en trámite', async () => {
    consultarTx.mockResolvedValueOnce([{ ...solicitudBloqueada, estado: 'AUTORIZADA' }]);

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza un paso inexistente', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([]);

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza un paso que ya fue resuelto', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([{ ...pasoBloqueado, estado: 'APROBADO' }]);

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('rechaza la decisión de un aprobador distinto al asignado', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([{ ...pasoBloqueado, aprobadorId: 99 }]);

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'CONFLICTO' });
  });

  it('acepta el identificador del aprobador cuando la base lo devuelve como texto', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([{ ...pasoBloqueado, aprobadorId: '20' }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.aprobarPasoIntermedio(7, datosIntermedios)).resolves.toBeUndefined();
  });

  it('traduce referencias inválidas en la transacción', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('propaga errores inesperados de la transacción', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo aprobación intermedia'));

    await expect(
      repositorio.aprobarPasoIntermedio(7, datosIntermedios),
    ).rejects.toThrow('Fallo aprobación intermedia');
  });
});

describe('autorizarSolicitud', () => {
  it('descuenta FIFO, registra el saldo previo, autoriza y notifica', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado])
      .mockResolvedValueOnce([
        { id: 1, diasDerecho: '5.00', diasUsados: '1.00' },
        { id: 2, diasDerecho: '4.00', diasUsados: '0.00' },
      ]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).resolves.toBeUndefined();

    expect(ejecutarTx).toHaveBeenCalledTimes(5);
    expect(obtenerLlamadaEjecutar(0)[1]?.[0]).toBe('APROBADO');
    expect(obtenerLlamadaEjecutar(1)[1]).toEqual([3, 7, 1]);
    expect(obtenerLlamadaEjecutar(2)[1]).toEqual([30, 1, 3]);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 3)[0]).toContain("estado = 'AUTORIZADA'");
    expect(obtenerLlamada(ejecutarTx.mock.calls, 3)[1]).toEqual([
      20, ahora, 1, 8, 7, 30,
    ]);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 4)[0]).toContain('INSERT INTO notificaciones');
    expect(obtenerLlamada(ejecutarTx.mock.calls, 4)[1]).toEqual([
      7, 10, 'SOLICITUD_APROBADA', 30, 'Su solicitud fue aprobada',
    ]);
  });

  it('continúa descontando en el siguiente periodo cuando el primero está agotado', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado])
      .mockResolvedValueOnce([
        { id: 1, diasDerecho: '2', diasUsados: '2' },
        { id: 2, diasDerecho: '5', diasUsados: '0' },
      ]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.autorizarSolicitud(7, {
      ...datosFinal,
      // Se solicitan tres días en la fila bloqueada.
    });

    expect(obtenerLlamadasEjecutar().some((llamada) => llamada[0].includes('periodo_id'))).toBe(true);
    expect(obtenerLlamadasEjecutar().find((llamada) => llamada[0].includes('periodo_id'))?.[1])
      .toEqual([30, 2, 3]);
  });

  it('detiene el descuento cuando ya completó los días solicitados', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado])
      .mockResolvedValueOnce([
        { id: 1, diasDerecho: '5', diasUsados: '0' },
        { id: 2, diasDerecho: '5', diasUsados: '0' },
      ]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await repositorio.autorizarSolicitud(7, datosFinal);

    expect(obtenerLlamadasEjecutar().filter((llamada) => llamada[0].includes('UPDATE periodos_vacaciones'))).toHaveLength(1);
  });

  it('rechaza si el saldo bloqueado ya no alcanza', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado])
      .mockResolvedValueOnce([
        { id: 1, diasDerecho: '2', diasUsados: '0' },
      ]);

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'El saldo de la persona ya no alcanza: tiene 2 dias disponibles y la solicitud pide 3',
    });
  });

  it('rechaza una solicitud inexistente al autorizar', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('rechaza una decisión cuyo paso pertenece a otro aprobador', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([{ ...pasoBloqueado, aprobadorId: 99 }]);

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('traduce referencias inválidas al autorizar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('propaga errores inesperados al autorizar', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo autorización'));

    await expect(repositorio.autorizarSolicitud(7, datosFinal)).rejects.toThrow(
      'Fallo autorización',
    );
  });
});

describe('negarSolicitud', () => {
  it('niega la solicitud, registra el motivo y notifica', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([pasoBloqueado]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.negarSolicitud(7, {
      ...datosFinal,
      motivo: 'No autorizado',
      notificacion: {
        ...notificacion,
        tipo: 'SOLICITUD_NEGADA',
        mensaje: 'Su solicitud fue negada',
      },
    })).resolves.toBeUndefined();

    expect(ejecutarTx).toHaveBeenCalledTimes(3);
    expect(obtenerLlamadaEjecutar(0)[1]?.[0]).toBe('NEGADO');
    expect(obtenerLlamadaEjecutar(1)[0]).toContain("estado = 'NEGADA'");
    expect(obtenerLlamadaEjecutar(1)[1]).toEqual([
      20, ahora, 'No autorizado', 7, 30,
    ]);
    expect(obtenerLlamadaEjecutar(2)[1]).toEqual([
      7, 10, 'SOLICITUD_NEGADA', 30, 'Su solicitud fue negada',
    ]);
  });

  it('rechaza una solicitud inexistente al negar', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(repositorio.negarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('rechaza un paso que ya no está pendiente al negar', async () => {
    consultarTx
      .mockResolvedValueOnce([solicitudBloqueada])
      .mockResolvedValueOnce([{ ...pasoBloqueado, estado: 'NEGADO' }]);

    await expect(repositorio.negarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('traduce referencias inválidas al negar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.negarSolicitud(7, datosFinal)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('propaga errores inesperados al negar', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo negación'));

    await expect(repositorio.negarSolicitud(7, datosFinal)).rejects.toThrow('Fallo negación');
  });
});

describe('cancelarSolicitud', () => {
  const datos: DatosCancelacion = {
    solicitudId: 30,
    usuarioId: 10,
    canceladaAt: ahora,
    motivo: 'Cambio de planes',
  };

  it('cancela la solicitud y sus pasos pendientes', async () => {
    consultarTx.mockResolvedValueOnce([solicitudBloqueada]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.cancelarSolicitud(7, datos)).resolves.toBeUndefined();

    expect(obtenerLlamada(consultarTx.mock.calls, 0)[0]).toContain('FOR UPDATE');
    expect(ejecutarTx).toHaveBeenCalledTimes(2);
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[0]).toContain("estado = 'CANCELADO'");
    expect(obtenerLlamada(ejecutarTx.mock.calls, 0)[1]).toEqual([10, ahora, 7, 30]);
    expect(obtenerLlamadaEjecutar(1)[0]).toContain("estado = 'CANCELADA'");
    expect(obtenerLlamadaEjecutar(1)[1]).toEqual([
      10, ahora, 'Cambio de planes', 7, 30,
    ]);
  });

  it('rechaza una solicitud inexistente', async () => {
    consultarTx.mockResolvedValueOnce([]);

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('rechaza cancelar una solicitud en VISTO_BUENO', async () => {
    consultarTx.mockResolvedValueOnce([{
      ...solicitudBloqueada,
      estado: 'VISTO_BUENO',
    }]);

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('rechaza cancelar una solicitud ya autorizada', async () => {
    consultarTx.mockResolvedValueOnce([{
      ...solicitudBloqueada,
      estado: 'AUTORIZADA',
    }]);

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('rechaza cancelar la solicitud de otra persona', async () => {
    consultarTx.mockResolvedValueOnce([{
      ...solicitudBloqueada,
      usuarioId: 99,
    }]);

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toMatchObject({
      codigo: 'PROHIBIDO',
      message: 'Solo quien la solicito puede cancelarla',
    });

    expect(ejecutarTx).not.toHaveBeenCalled();
  });

  it('acepta el identificador del solicitante devuelto como texto', async () => {
    consultarTx.mockResolvedValueOnce([{
      ...solicitudBloqueada,
      usuarioId: '10',
    }]);
    ejecutarTx.mockResolvedValue({ filasAfectadas: 1, idInsertado: 0 });

    await expect(repositorio.cancelarSolicitud(7, datos)).resolves.toBeUndefined();
  });

  it('traduce referencias inválidas al cancelar', async () => {
    transaccion.mockRejectedValueOnce({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
    });
  });

  it('propaga errores inesperados al cancelar', async () => {
    transaccion.mockRejectedValueOnce(new Error('Fallo cancelación'));

    await expect(repositorio.cancelarSolicitud(7, datos)).rejects.toThrow('Fallo cancelación');
  });
});

describe('obtenerSolicitud', () => {
  it('devuelve null cuando la solicitud no existe', async () => {
    consultar.mockResolvedValueOnce([]);

    await expect(repositorio.obtenerSolicitud(7, 30, '2026-11-04')).resolves.toBeNull();
    expect(consultar).toHaveBeenCalledOnce();
  });

  it('devuelve el detalle y mapea aprobador disponible y persona que decidió', async () => {
    consultar
      .mockResolvedValueOnce([filaSolicitud])
      .mockResolvedValueOnce([{
        ...filaPaso,
        aprobadorDisponible: 1,
        decididoPorId: 25,
        decididoPorNombres: 'María',
        decididoPorApellidos: 'López',
      }]);

    const resultado = await repositorio.obtenerSolicitud(7, 30, '2026-11-04');

    expect(resultado).toMatchObject({
      id: 30,
      ordenTramite: 'VAC-2026-000001',
      solicitante: {
        id: 10,
        cedula: '0102030405',
        nombres: 'Ana',
        apellidos: 'Pérez',
      },
      area: { id: 2, detalle: 'Emergencia' },
      cargo: { id: 3, detalle: 'Enfermera' },
      diasSolicitados: 3,
      pasos: [{
        id: 40,
        aprobadorDisponible: true,
        decididoPor: { id: 25, nombres: 'María', apellidos: 'López' },
      }],
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 30]);
    expect(obtenerLlamada(consultar.mock.calls, 1)[1]).toEqual(['2026-11-04', 7, 30]);
  });

  it('mapea persona que decidió como null cuando faltan sus datos', async () => {
    consultar
      .mockResolvedValueOnce([filaSolicitud])
      .mockResolvedValueOnce([{
        ...filaPaso,
        decididoPorId: 25,
        decididoPorNombres: null,
        decididoPorApellidos: 'López',
      }]);

    const resultado = await repositorio.obtenerSolicitud(7, 30, '2026-11-04');

    expect(resultado?.pasos[0]?.decididoPor).toBeNull();
  });

  it('mapea persona que decidió como null cuando su identificador es null', async () => {
    consultar
      .mockResolvedValueOnce([filaSolicitud])
      .mockResolvedValueOnce([filaPaso]);

    const resultado = await repositorio.obtenerSolicitud(7, 30, '2026-11-04');

    expect(resultado?.pasos[0]?.decididoPor).toBeNull();
  });

  it('marca al aprobador como no disponible cuando el indicador no es uno', async () => {
    consultar
      .mockResolvedValueOnce([filaSolicitud])
      .mockResolvedValueOnce([{
        ...filaPaso,
        aprobadorDisponible: 0,
      }]);

    const resultado = await repositorio.obtenerSolicitud(7, 30, '2026-11-04');

    expect(resultado?.pasos[0]?.aprobadorDisponible).toBe(false);
  });

  it('conserva los valores nulos de la solicitud y devuelve pasos vacíos', async () => {
    consultar
      .mockResolvedValueOnce([{
        ...filaSolicitud,
        telefonoLocalizacion: null,
        justificacion: null,
        motivoResolucion: null,
        fechaResolucion: null,
        diasSolicitados: 2,
      }])
      .mockResolvedValueOnce([]);

    const resultado = await repositorio.obtenerSolicitud(7, 30, '2026-11-04');

    expect(resultado).toMatchObject({
      telefonoLocalizacion: null,
      justificacion: null,
      motivoResolucion: null,
      fechaResolucion: null,
      diasSolicitados: 2,
      pasos: [],
    });
  });

  it('propaga errores al consultar el detalle', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo detalle'));

    await expect(repositorio.obtenerSolicitud(7, 30, '2026-11-04')).rejects.toThrow(
      'Fallo detalle',
    );
  });
});

describe('listarSolicitudesDe', () => {
  const filtros: FiltrosSolicitudes = {
    pagina: 1,
    porPagina: 10,
  };

  const resumen = {
    id: 30,
    ordenTramite: 'VAC-2026-000001',
    fechaInicio: '2026-12-01',
    fechaFin: '2026-12-03',
    diasSolicitados: '3.00',
    tipo: 'PROGRAMADA',
    estado: 'PENDIENTE',
    solicitadoAt: ahora,
  };

  it('lista las solicitudes del usuario y convierte días y total', async () => {
    consultar
      .mockResolvedValueOnce([resumen])
      .mockResolvedValueOnce([{ total: '12' }]);

    await expect(repositorio.listarSolicitudesDe(7, 10, filtros)).resolves.toEqual({
      solicitudes: [{ ...resumen, diasSolicitados: 3 }],
      total: 12,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10]);
    expect(obtenerLlamada(consultar.mock.calls, 1)[1]).toEqual([7, 10]);
    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 10 OFFSET 0');
  });

  it('agrega el filtro de estado mediante parámetro', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.listarSolicitudesDe(7, 10, {
      ...filtros,
      estado: 'AUTORIZADA',
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('AND s.estado = ?');
    expect(obtenerLlamada(consultar.mock.calls, 0)[1]).toEqual([7, 10, 'AUTORIZADA']);
    expect(obtenerLlamada(consultar.mock.calls, 1)[1]).toEqual([7, 10, 'AUTORIZADA']);
  });

  it('calcula el desplazamiento y trunca los valores de paginación', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await repositorio.listarSolicitudesDe(7, 10, {
      pagina: 3.8,
      porPagina: 5.9,
    });

    expect(obtenerLlamada(consultar.mock.calls, 0)[0]).toContain('LIMIT 5 OFFSET 10');
  });

  it('devuelve lista vacía y total cero cuando no hay filas ni conteo', async () => {
    consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(repositorio.listarSolicitudesDe(7, 10, filtros)).resolves.toEqual({
      solicitudes: [],
      total: 0,
    });
  });

  it('convierte días numéricos sin alterar su valor', async () => {
    consultar
      .mockResolvedValueOnce([{ ...resumen, diasSolicitados: 2.5 }])
      .mockResolvedValueOnce([{ total: 1 }]);

    const resultado = await repositorio.listarSolicitudesDe(7, 10, filtros);

    expect(resultado.solicitudes[0]?.diasSolicitados).toBe(2.5);
  });

  it('propaga errores de consulta de la lista', async () => {
    consultar.mockRejectedValueOnce(new Error('Fallo listado'));

    await expect(repositorio.listarSolicitudesDe(7, 10, filtros)).rejects.toThrow(
      'Fallo listado',
    );
  });
});