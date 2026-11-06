// Pruebas unitarias del controlador de jornadas.
// Verifica la traducción de peticiones HTTP a llamadas del servicio.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearJornadasController } from '../../../../src/modules/jornadas/jornadas.controller';
import type { JornadasService } from '../../../../src/modules/jornadas/jornadas.service';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';

describe('crearJornadasController', () => {
  const actor = {
    id: 15,
    empresaId: 3,
  } as UsuarioAutenticado;

  const servicio = {
    listarTurnos: vi.fn(),
    obtenerTurno: vi.fn(),
    crearTurno: vi.fn(),
    actualizarTurno: vi.fn(),
    listarPatrones: vi.fn(),
    obtenerPatron: vi.fn(),
    crearPatron: vi.fn(),
    crearAsignacion: vi.fn(),
    cerrarAsignacion: vi.fn(),
    obtenerJornadaParaFecha: vi.fn(),
  };

  const controlador = crearJornadasController(
    servicio as unknown as JornadasService,
  );

  const respuesta = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  const peticion = (datos: Record<string, unknown> = {}) =>
    ({
      usuario: actor,
      params: {},
      query: {},
      body: {},
      ...datos,
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();

    servicio.listarTurnos.mockResolvedValue([]);
    servicio.obtenerTurno.mockResolvedValue({ id: 1 });
    servicio.crearTurno.mockResolvedValue({ id: 2 });
    servicio.actualizarTurno.mockResolvedValue({ id: 1 });
    servicio.listarPatrones.mockResolvedValue([]);
    servicio.obtenerPatron.mockResolvedValue({ id: 3 });
    servicio.crearPatron.mockResolvedValue({ id: 4 });
    servicio.crearAsignacion.mockResolvedValue({ id: 5 });
    servicio.cerrarAsignacion.mockResolvedValue({ id: 5 });
    servicio.obtenerJornadaParaFecha.mockResolvedValue({
      fecha: '2026-11-04',
      esDescanso: true,
      turno: null,
      minutosLaborables: 0,
    });
  });

  it('lista turnos excluyendo inactivos por defecto', async () => {
    const res = respuesta();
    const turnos = [{ id: 1 }, { id: 2 }];
    servicio.listarTurnos.mockResolvedValue(turnos);

    await controlador.listarTurnos(peticion() , res as never, vi.fn());

    expect(servicio.listarTurnos).toHaveBeenCalledWith(actor, false);
    expect(res.json).toHaveBeenCalledWith({ turnos });
  });

  it('lista turnos incluyendo inactivos cuando se solicita', async () => {
    const res = respuesta();

    await controlador.listarTurnos(
      peticion({ query: { incluirInactivos: true } }),
      res as never,
      vi.fn(),
    );

    expect(servicio.listarTurnos).toHaveBeenCalledWith(actor, true);
    expect(res.json).toHaveBeenCalledWith({ turnos: [] });
  });

  it('obtiene un turno usando el identificador de la ruta', async () => {
    const res = respuesta();
    const turno = { id: 8 };
    servicio.obtenerTurno.mockResolvedValue(turno);

    await controlador.obtenerTurno(
      peticion({ params: { id: '8' } }),
      res as never,
      vi.fn(),
    );

    expect(servicio.obtenerTurno).toHaveBeenCalledWith(actor, 8);
    expect(res.json).toHaveBeenCalledWith({ turno });
  });

  it('crea un turno y responde con estado 201', async () => {
    const res = respuesta();
    const datos = {
      nombre: 'Diurno',
      horaInicio: '08:00:00',
      horaFin: '16:00:00',
      minutosDescanso: 30,
    };
    const turno = { id: 9 };
    servicio.crearTurno.mockResolvedValue(turno);

    await controlador.crearTurno(
      peticion({ body: datos }),
      res as never,
      vi.fn(),
    );

    expect(servicio.crearTurno).toHaveBeenCalledWith(actor, datos);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ turno });
  });

  it('actualiza un turno usando actor, identificador y datos', async () => {
    const res = respuesta();
    const datos = {
      nombre: 'Nocturno',
      horaInicio: '22:00:00',
      horaFin: '06:00:00',
      minutosDescanso: 20,
      activo: true,
    };
    const turno = { id: 10 };
    servicio.actualizarTurno.mockResolvedValue(turno);

    await controlador.actualizarTurno(
      peticion({ params: { id: '10' }, body: datos }),
      res as never,
      vi.fn(),
    );

    expect(servicio.actualizarTurno).toHaveBeenCalledWith(actor, 10, datos);
    expect(res.json).toHaveBeenCalledWith({ turno });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lista patrones excluyendo inactivos por defecto', async () => {
    const res = respuesta();
    const patrones = [{ id: 1 }];
    servicio.listarPatrones.mockResolvedValue(patrones);

    await controlador.listarPatrones(peticion(), res as never, vi.fn());

    expect(servicio.listarPatrones).toHaveBeenCalledWith(actor, false);
    expect(res.json).toHaveBeenCalledWith({ patrones });
  });

  it('lista patrones incluyendo inactivos cuando se solicita', async () => {
    const res = respuesta();

    await controlador.listarPatrones(
      peticion({ query: { incluirInactivos: true } }),
      res as never,
      vi.fn(),
    );

    expect(servicio.listarPatrones).toHaveBeenCalledWith(actor, true);
    expect(res.json).toHaveBeenCalledWith({ patrones: [] });
  });

  it('obtiene un patrón usando el identificador de la ruta', async () => {
    const res = respuesta();
    const patron = { id: 11 };
    servicio.obtenerPatron.mockResolvedValue(patron);

    await controlador.obtenerPatron(
      peticion({ params: { id: '11' } }),
      res as never,
      vi.fn(),
    );

    expect(servicio.obtenerPatron).toHaveBeenCalledWith(actor, 11);
    expect(res.json).toHaveBeenCalledWith({ patron });
  });

  it('crea un patrón y responde con estado 201', async () => {
    const res = respuesta();
    const datos = {
      nombre: 'Rotativo',
      descripcion: null,
      cicloDias: 1,
      dias: [{ diaCiclo: 1, tipoDia: 'DESCANSO', turnoId: null }],
    };
    const patron = { id: 12 };
    servicio.crearPatron.mockResolvedValue(patron);

    await controlador.crearPatron(
      peticion({ body: datos }),
      res as never,
      vi.fn(),
    );

    expect(servicio.crearPatron).toHaveBeenCalledWith(actor, datos);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ patron });
  });

  it('crea una asignación y responde con estado 201', async () => {
    const res = respuesta();
    const datos = {
      usuarioId: 20,
      patronId: 12,
      fechaInicio: '2026-11-01',
      fechaReferencia: '2026-11-01',
    };
    const asignacion = { id: 13 };
    servicio.crearAsignacion.mockResolvedValue(asignacion);

    await controlador.crearAsignacion(
      peticion({ body: datos }),
      res as never,
      vi.fn(),
    );

    expect(servicio.crearAsignacion).toHaveBeenCalledWith(actor, datos);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ asignacion });
  });

  it('cierra una asignación y responde con su resultado', async () => {
    const res = respuesta();
    const datos = {
      asignacionId: 13,
      fechaFin: '2026-11-30',
    };
    const asignacion = { id: 13, fechaFin: datos.fechaFin };
    servicio.cerrarAsignacion.mockResolvedValue(asignacion);

    await controlador.cerrarAsignacion(
      peticion({ body: datos }),
      res as never,
      vi.fn(),
    );

    expect(servicio.cerrarAsignacion).toHaveBeenCalledWith(actor, datos);
    expect(res.json).toHaveBeenCalledWith({ asignacion });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('consulta la jornada de un empleado para una fecha', async () => {
    const res = respuesta();
    const jornada = {
      fecha: '2026-11-04',
      esDescanso: false,
      turno: { id: 2 },
      minutosLaborables: 450,
    };
    servicio.obtenerJornadaParaFecha.mockResolvedValue(jornada);

    await controlador.consultarJornada(
      peticion({
        query: {
          usuarioId: 20,
          fecha: '2026-11-04',
        },
      }),
      res as never,
      vi.fn(),
    );

    expect(servicio.obtenerJornadaParaFecha).toHaveBeenCalledWith(
      actor,
      20,
      '2026-11-04',
    );
    expect(res.json).toHaveBeenCalledWith({ jornada });
  });
});