// Pruebas HTTP del modulo vacaciones: sesion, CSRF, validacion, visibilidad por persona, decisiones y aislamiento
// entre hospitales. Usa el router real con tokens reales, un repositorio en memoria y un reloj fijo;
// no necesita MySQL ni Redis.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { crearVacacionesController } from '../../../src/modules/vacaciones/vacaciones.controller';
import { crearVacacionesRouter } from '../../../src/modules/vacaciones/vacaciones.routes';
import { VacacionesService } from '../../../src/modules/vacaciones/vacaciones.service';
import { tokensJwt } from '../../../src/shared/security/tokens';
import type { CodigoRol } from '../../../src/shared/types/roles';
import { calcularDiasLaborables } from '../../../src/shared/utils/fechas';
import { crearSesionesEnMemoria } from '../../helpers/auth';
import { crearVacacionesEnMemoria } from '../../helpers/vacaciones';
import type { PersonaDePrueba } from '../../helpers/vacaciones';

interface CuerpoError {
  codigo: string;
}
interface CuerpoSolicitud {
  solicitud: {
    id: number;
    ordenTramite: string;
    tipo: string;
    estado: string;
    diasSolicitados: number;
    motivoResolucion: string | null;
    pasos: { tipoAprobador: string; estado: string; aprobador: { id: number } }[];
  };
}
interface CuerpoPagina {
  solicitudes: { id: number; estado: string }[];
  total: number;
  pagina: number;
  porPagina: number;
}

const CSRF = 'token-csrf-de-prueba';
const BASE = '/api/vacaciones/solicitudes';

// Jueves 15 de octubre de 2026, 10:00 en Guayaquil (15:00 UTC)
const AHORA = new Date('2026-10-15T15:00:00Z');

// Lunes 2 al viernes 6 de noviembre: 18 dias de anticipacion y 3 laborables (hay 2 feriados)
const programada = { fechaInicio: '2026-11-02', fechaFin: '2026-11-06' };

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

// Escenario: Luis (1) y Lucia (8) son empleados de Laura (2); en el hospital ajeno (6), Ana (30) tiene jefe (31)
function crearEscenario() {
  const memoria = crearVacacionesEnMemoria();
  const { personas } = memoria;
  personas.set(2, persona(2, { nivelJerarquico: 3 }));
  personas.set(1, persona(1, { jefeInmediatoId: 2 }));
  personas.set(8, persona(8, { jefeInmediatoId: 2 }));
  personas.set(31, persona(31, { empresaId: 6, nivelJerarquico: 3 }));
  personas.set(30, persona(30, { empresaId: 6, jefeInmediatoId: 31 }));
  for (const id of [1, 8, 30]) {
    memoria.saldos.set(id, 60);
  }
  memoria.rutas.set(5, ['JEFE_INMEDIATO']);
  // 2 y 3 de noviembre son feriados
  memoria.feriados.add('2026-11-02');
  memoria.feriados.add('2026-11-03');

  const servicio = new VacacionesService({
    repositorio: memoria.repositorio,
    calcularDiasLaborables,
    plazoAprobacionHoras: 1,
    ahora: () => AHORA,
  });
  const { sesiones } = crearSesionesEnMemoria();

  const router = crearVacacionesRouter({
    controller: crearVacacionesController(servicio),
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrf);
  app.use('/api/vacaciones', router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  return { app };
}

// Access token real para una persona, su rol y su hospital
async function tokenDe(usuarioId: number, rol: CodigoRol = 'EMPLEADO', empresaId = 5): Promise<string> {
  return tokensJwt.firmarAcceso({
    usuarioId,
    empresaId,
    rol,
    jti: `jti-${rol}-${String(usuarioId)}-${String(empresaId)}`,
  });
}

// Agrega sesion y CSRF a una peticion
function autorizar(prueba: request.Test, accessToken: string): request.Test {
  return prueba
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', `${COOKIE_CSRF}=${CSRF}`)
    .set(CABECERA_CSRF, CSRF);
}

describe('crear', () => {
  it('exige sesion', async () => {
    const { app } = crearEscenario();
    const respuesta = await request(app).get(BASE);
    expect(respuesta.status).toBe(401);
  });

  it('crea la solicitud con 201 y su primer paso es del jefe inmediato', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe(1)).send(programada);
    const { solicitud } = respuesta.body as CuerpoSolicitud;

    expect(respuesta.status).toBe(201);
    expect(solicitud).toMatchObject({
      ordenTramite: 'VAC-2026-000001',
      tipo: 'PROGRAMADA',
      estado: 'PENDIENTE',
      diasSolicitados: 3,
    });
    expect(solicitud.pasos).toHaveLength(1);
    expect(solicitud.pasos[0]).toMatchObject({ tipoAprobador: 'JEFE_INMEDIATO', estado: 'PENDIENTE' });
    expect(solicitud.pasos[0]?.aprobador.id).toBe(2);
  });

  it('rechaza un POST sin token CSRF', async () => {
    const { app } = crearEscenario();
    const respuesta = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${await tokenDe(1)}`)
      .send(programada);
    expect(respuesta.status).toBe(403);
  });

  it('rechaza los campos que pone el servidor (empresaId, usuarioId y estado)', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe(1);
    for (const extra of [{ empresaId: 6 }, { usuarioId: 8 }, { estado: 'AUTORIZADA' }]) {
      const respuesta = await autorizar(request(app).post(BASE), token).send({ ...programada, ...extra });
      expect(respuesta.status).toBe(400);
      expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
    }
  });

  it('rechaza fechas inexistentes o con el fin anterior al inicio', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe(1);

    const inexistente = await autorizar(request(app).post(BASE), token).send({
      fechaInicio: '2026-02-31',
      fechaFin: '2026-03-02',
    });
    expect(inexistente.status).toBe(400);

    const invertida = await autorizar(request(app).post(BASE), token).send({
      fechaInicio: '2026-11-06',
      fechaFin: '2026-11-02',
    });
    expect(invertida.status).toBe(400);
    expect((invertida.body as CuerpoError).codigo).toBe('VALIDACION');
  });

  it('responde 422 si falta la justificacion de una solicitud no programada', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe(1)).send({
      fechaInicio: '2026-10-19',
      fechaFin: '2026-10-20',
    });
    expect(respuesta.status).toBe(422);
    expect((respuesta.body as CuerpoError).codigo).toBe('REGLA_DE_NEGOCIO');
  });

  it('responde 409 si las fechas se cruzan con otra solicitud de la misma persona', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe(1);
    await autorizar(request(app).post(BASE), token).send(programada);
    const respuesta = await autorizar(request(app).post(BASE), token).send({
      fechaInicio: '2026-11-05',
      fechaFin: '2026-11-10',
    });
    expect(respuesta.status).toBe(409);
    expect((respuesta.body as CuerpoError).codigo).toBe('CONFLICTO');
  });

  it('el numero de tramite es correlativo por hospital', async () => {
    const { app } = crearEscenario();
    const propia = await autorizar(request(app).post(BASE), await tokenDe(1)).send(programada);
    const ajena = await autorizar(request(app).post(BASE), await tokenDe(30, 'EMPLEADO', 6)).send(programada);
    expect((propia.body as CuerpoSolicitud).solicitud.ordenTramite).toBe('VAC-2026-000001');
    expect((ajena.body as CuerpoSolicitud).solicitud.ordenTramite).toBe('VAC-2026-000001');
  });
});

describe('obtener', () => {
  async function solicitudDeLuis() {
    const { app } = crearEscenario();
    const creada = await autorizar(request(app).post(BASE), await tokenDe(1)).send(programada);
    return { app, id: (creada.body as CuerpoSolicitud).solicitud.id };
  }

  it('exige sesion', async () => {
    const { app, id } = await solicitudDeLuis();
    const respuesta = await request(app).get(`${BASE}/${String(id)}`);
    expect(respuesta.status).toBe(401);
  });

  it('el solicitante ve su solicitud', async () => {
    const { app, id } = await solicitudDeLuis();
    const respuesta = await autorizar(request(app).get(`${BASE}/${String(id)}`), await tokenDe(1));
    expect(respuesta.status).toBe(200);
    expect((respuesta.body as CuerpoSolicitud).solicitud.id).toBe(id);
  });

  it('su jefa aprobadora y Talento Humano del mismo hospital tambien la ven', async () => {
    const { app, id } = await solicitudDeLuis();
    const jefa = await autorizar(request(app).get(`${BASE}/${String(id)}`), await tokenDe(2, 'JEFE_AREA'));
    expect(jefa.status).toBe(200);
    const talento = await autorizar(request(app).get(`${BASE}/${String(id)}`), await tokenDe(50, 'TALENTO_HUMANO'));
    expect(talento.status).toBe(200);
  });

  it('otro empleado recibe 404, como si no existiera', async () => {
    const { app, id } = await solicitudDeLuis();
    const respuesta = await autorizar(request(app).get(`${BASE}/${String(id)}`), await tokenDe(8));
    expect(respuesta.status).toBe(404);
  });

  it('Talento Humano de otro hospital recibe 404', async () => {
    const { app, id } = await solicitudDeLuis();
    const respuesta = await autorizar(
      request(app).get(`${BASE}/${String(id)}`),
      await tokenDe(50, 'TALENTO_HUMANO', 6),
    );
    expect(respuesta.status).toBe(404);
  });

  it('responde 400 si el id no es un numero y 404 si no existe', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe(1);
    const invalido = await autorizar(request(app).get(`${BASE}/abc`), token);
    expect(invalido.status).toBe(400);
    expect((invalido.body as CuerpoError).codigo).toBe('VALIDACION');

    const inexistente = await autorizar(request(app).get(`${BASE}/9999`), token);
    expect(inexistente.status).toBe(404);
  });
});

describe('listar', () => {
  async function conDosSolicitudesDeLuis() {
    const { app } = crearEscenario();
    const token = await tokenDe(1);
    const primera = await autorizar(request(app).post(BASE), token).send(programada);
    const segunda = await autorizar(request(app).post(BASE), token).send({
      fechaInicio: '2026-11-09',
      fechaFin: '2026-11-10',
    });
    return {
      app,
      token,
      idPrimera: (primera.body as CuerpoSolicitud).solicitud.id,
      idSegunda: (segunda.body as CuerpoSolicitud).solicitud.id,
    };
  }

  it('lista solo las propias, la mas reciente primero, con valores por defecto de paginacion', async () => {
    const { app, token, idPrimera, idSegunda } = await conDosSolicitudesDeLuis();
    const respuesta = await autorizar(request(app).get(BASE), token);
    const cuerpo = respuesta.body as CuerpoPagina;
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({ total: 2, pagina: 1, porPagina: 20 });
    expect(cuerpo.solicitudes.map((s) => s.id)).toEqual([idSegunda, idPrimera]);
  });

  it('pagina los resultados', async () => {
    const { app, token, idPrimera } = await conDosSolicitudesDeLuis();
    const respuesta = await autorizar(request(app).get(`${BASE}?pagina=2&porPagina=1`), token);
    const cuerpo = respuesta.body as CuerpoPagina;
    expect(cuerpo).toMatchObject({ total: 2, pagina: 2, porPagina: 1 });
    expect(cuerpo.solicitudes.map((s) => s.id)).toEqual([idPrimera]);
  });

  it('filtra por estado y no mezcla personas', async () => {
    const { app, token } = await conDosSolicitudesDeLuis();
    const autorizadas = await autorizar(request(app).get(`${BASE}?estado=AUTORIZADA`), token);
    expect((autorizadas.body as CuerpoPagina).total).toBe(0);

    const deOtra = await autorizar(request(app).get(BASE), await tokenDe(8));
    expect((deOtra.body as CuerpoPagina).total).toBe(0);
  });

  it('rechaza filtros invalidos o desconocidos', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe(1);
    for (const consulta of ['porPagina=500', 'pagina=0', 'estado=XX', 'empresaId=6']) {
      const respuesta = await autorizar(request(app).get(`${BASE}?${consulta}`), token);
      expect(respuesta.status).toBe(400);
      expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
    }
  });
});

describe('aprobar y negar', () => {
  async function conSolicitudDeLuis() {
    const { app } = crearEscenario();
    const creada = await autorizar(request(app).post(BASE), await tokenDe(1)).send(programada);
    return { app, id: (creada.body as CuerpoSolicitud).solicitud.id };
  }
  const ruta = (id: number, accion: string): string => `${BASE}/${String(id)}/${accion}`;

  it('la jefa aprueba, aun sin cuerpo: 200 y la solicitud queda AUTORIZADA', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'aprobar')), await tokenDe(2, 'JEFE_AREA'));
    const { solicitud } = respuesta.body as CuerpoSolicitud;

    expect(respuesta.status).toBe(200);
    expect(solicitud.estado).toBe('AUTORIZADA');
    expect(solicitud.pasos[0]?.estado).toBe('APROBADO');
  });

  it('acepta un motivo opcional al aprobar', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'aprobar')), await tokenDe(2, 'JEFE_AREA')).send({
      motivo: 'Buen viaje',
    });
    expect(respuesta.status).toBe(200);
  });

  it('quien solicito no puede aprobar su propia solicitud: 403', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'aprobar')), await tokenDe(1)).send({});
    expect(respuesta.status).toBe(403);
    expect((respuesta.body as CuerpoError).codigo).toBe('PROHIBIDO');
  });

  it('Talento Humano ve la solicitud pero no le toca decidirla: 403', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(
      request(app).post(ruta(id, 'aprobar')),
      await tokenDe(50, 'TALENTO_HUMANO'),
    ).send({});
    expect(respuesta.status).toBe(403);
  });

  it('otro empleado y otro hospital reciben 404', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const empleado = await autorizar(request(app).post(ruta(id, 'aprobar')), await tokenDe(8)).send({});
    expect(empleado.status).toBe(404);
    const ajeno = await autorizar(
      request(app).post(ruta(id, 'aprobar')),
      await tokenDe(31, 'JEFE_AREA', 6),
    ).send({});
    expect(ajeno.status).toBe(404);
  });

  it('no se aprueba dos veces: la segunda recibe 409', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const token = await tokenDe(2, 'JEFE_AREA');
    await autorizar(request(app).post(ruta(id, 'aprobar')), token).send({});
    const segunda = await autorizar(request(app).post(ruta(id, 'aprobar')), token).send({});
    expect(segunda.status).toBe(409);
    expect((segunda.body as CuerpoError).codigo).toBe('CONFLICTO');
  });

  it('rechaza motivos invalidos y campos que no existen', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const token = await tokenDe(2, 'JEFE_AREA');
    for (const cuerpo of [{ motivo: 'x'.repeat(501) }, { motivo: '' }, { estado: 'AUTORIZADA' }]) {
      const respuesta = await autorizar(request(app).post(ruta(id, 'aprobar')), token).send(cuerpo);
      expect(respuesta.status).toBe(400);
      expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
    }
  });

  it('rechaza un POST sin token CSRF', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await request(app)
      .post(ruta(id, 'aprobar'))
      .set('Authorization', `Bearer ${await tokenDe(2, 'JEFE_AREA')}`)
      .send({});
    expect(respuesta.status).toBe(403);
  });

  it('responde 400 si el id no es un numero', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).post(`${BASE}/abc/aprobar`), await tokenDe(2, 'JEFE_AREA')).send({});
    expect(respuesta.status).toBe(400);
  });

  it('la jefa niega con motivo: queda NEGADA y el motivo se guarda', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'negar')), await tokenDe(2, 'JEFE_AREA')).send({
      motivo: 'Hay mucha carga en el servicio',
    });
    const { solicitud } = respuesta.body as CuerpoSolicitud;

    expect(respuesta.status).toBe(200);
    expect(solicitud).toMatchObject({ estado: 'NEGADA', motivoResolucion: 'Hay mucha carga en el servicio' });
    expect(solicitud.pasos[0]?.estado).toBe('NEGADO');
  });

  it('el motivo al negar es opcional', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'negar')), await tokenDe(2, 'JEFE_AREA'));
    const { solicitud } = respuesta.body as CuerpoSolicitud;
    expect(respuesta.status).toBe(200);
    expect(solicitud).toMatchObject({ estado: 'NEGADA', motivoResolucion: null });
  });

  it('solo niega quien tiene asignado el paso: 403 para quien solicito', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'negar')), await tokenDe(1)).send({});
    expect(respuesta.status).toBe(403);
  });
});

describe('cancelar', () => {
  async function conSolicitudDeLuis() {
    const { app } = crearEscenario();
    const creada = await autorizar(request(app).post(BASE), await tokenDe(1)).send(programada);
    return { app, id: (creada.body as CuerpoSolicitud).solicitud.id };
  }
  const ruta = (id: number, accion: string): string => `${BASE}/${String(id)}/${accion}`;

  it('la persona cancela su solicitud en tramite: 200 y queda CANCELADA', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const respuesta = await autorizar(request(app).post(ruta(id, 'cancelar')), await tokenDe(1)).send({
      motivo: 'Cambie de planes',
    });
    const { solicitud } = respuesta.body as CuerpoSolicitud;

    expect(respuesta.status).toBe(200);
    expect(solicitud).toMatchObject({ estado: 'CANCELADA', motivoResolucion: 'Cambie de planes' });
    expect(solicitud.pasos[0]?.estado).toBe('CANCELADO');
  });

  it('la jefa la ve pero no puede cancelarla: 403; otro empleado recibe 404', async () => {
    const { app, id } = await conSolicitudDeLuis();
    const jefa = await autorizar(request(app).post(ruta(id, 'cancelar')), await tokenDe(2, 'JEFE_AREA')).send({});
    expect(jefa.status).toBe(403);
    const otro = await autorizar(request(app).post(ruta(id, 'cancelar')), await tokenDe(8)).send({});
    expect(otro.status).toBe(404);
  });

  it('una solicitud autorizada no se cancela: 409', async () => {
    const { app, id } = await conSolicitudDeLuis();
    await autorizar(request(app).post(ruta(id, 'aprobar')), await tokenDe(2, 'JEFE_AREA')).send({});
    const respuesta = await autorizar(request(app).post(ruta(id, 'cancelar')), await tokenDe(1)).send({});
    expect(respuesta.status).toBe(409);
    expect((respuesta.body as CuerpoError).codigo).toBe('CONFLICTO');
  });

  it('una solicitud cancelada ya no se puede aprobar: 409', async () => {
    const { app, id } = await conSolicitudDeLuis();
    await autorizar(request(app).post(ruta(id, 'cancelar')), await tokenDe(1)).send({});
    const respuesta = await autorizar(
      request(app).post(ruta(id, 'aprobar')),
      await tokenDe(2, 'JEFE_AREA'),
    ).send({});
    expect(respuesta.status).toBe(409);
  });
});