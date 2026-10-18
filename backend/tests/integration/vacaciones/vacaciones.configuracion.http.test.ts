// Pruebas HTTP de la configuracion de dias de vacaciones: solo SUPERADMIN, validacion, CSRF y aislamiento por hospital.
// Usa el router real con tokens reales y un repositorio en memoria; no necesita MySQL ni Redis.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { crearConfiguracionVacacionesController } from '../../../src/modules/vacaciones/vacaciones.configuracion.controller';
import { crearConfiguracionVacacionesRouter } from '../../../src/modules/vacaciones/vacaciones.configuracion.routes';
import { PeriodosService } from '../../../src/modules/vacaciones/vacaciones.periodos.service';
import { tokensJwt } from '../../../src/shared/security/tokens';
import type { CodigoRol } from '../../../src/shared/types/roles';
import { crearSesionesEnMemoria } from '../../helpers/auth';
import { crearPeriodosEnMemoria } from '../../helpers/periodos';

interface CuerpoError {
  codigo: string;
}
interface CuerpoConfiguracion {
  configuracion: { diasVacaciones: number | null; diasEfectivos: number; origen: string };
}

const CSRF = 'token-csrf-de-prueba';
const BASE = '/api/vacaciones/configuracion';
const ID_SUPERADMIN = 99;

// Escenario: area 10 (raiz) con la subarea 11; la persona 1 trabaja en la 11. El area 20 es de otro hospital.
function crearEscenario() {
  const memoria = crearPeriodosEnMemoria();
  memoria.areas.set(10, { empresaId: 5, parentId: null, diasVacaciones: null });
  memoria.areas.set(11, { empresaId: 5, parentId: 10, diasVacaciones: null });
  memoria.areas.set(20, { empresaId: 6, parentId: null, diasVacaciones: null });
  memoria.personas.set(1, { empresaId: 5, areaId: 11, fechaIngreso: '2022-01-10', diasVacaciones: null });

  const servicio = new PeriodosService({ repositorio: memoria.repositorio, diasPorDefecto: 30 });
  const { sesiones } = crearSesionesEnMemoria();
  const router = crearConfiguracionVacacionesRouter({
    controller: crearConfiguracionVacacionesController(servicio),
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrf);
  app.use(BASE, router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  return { app, ...memoria };
}

// Access token real para un rol y un hospital
async function tokenDe(rol: CodigoRol = 'SUPERADMIN', empresaId = 5): Promise<string> {
  return tokensJwt.firmarAcceso({
    usuarioId: ID_SUPERADMIN,
    empresaId,
    rol,
    jti: `jti-${rol}-${String(empresaId)}`,
  });
}

// Agrega sesion y CSRF a una peticion
function autorizar(prueba: request.Test, accessToken: string): request.Test {
  return prueba
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', `${COOKIE_CSRF}=${CSRF}`)
    .set(CABECERA_CSRF, CSRF);
}

describe('acceso', () => {
  it('exige sesion', async () => {
    const { app } = crearEscenario();
    const respuesta = await request(app).get(`${BASE}/areas/11/dias`);
    expect(respuesta.status).toBe(401);
  });

  it('solo el SUPERADMIN: los demas roles reciben 403 al consultar y al cambiar', async () => {
    const { app } = crearEscenario();
    for (const rol of ['EMPLEADO', 'TALENTO_HUMANO', 'JEFE_AREA'] as const) {
      const token = await tokenDe(rol);
      const consulta = await autorizar(request(app).get(`${BASE}/areas/11/dias`), token);
      expect(consulta.status).toBe(403);
      const cambio = await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send({ diasVacaciones: 35 });
      expect(cambio.status).toBe(403);
    }
  });

  it('rechaza un PUT sin token CSRF', async () => {
    const { app } = crearEscenario();
    const respuesta = await request(app)
      .put(`${BASE}/areas/11/dias`)
      .set('Authorization', `Bearer ${await tokenDe()}`)
      .send({ diasVacaciones: 35 });
    expect(respuesta.status).toBe(403);
  });
});

describe('areas', () => {
  it('consulta lo que rige en un area sin configurar: el valor por defecto', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/areas/11/dias`), await tokenDe());
    expect(respuesta.status).toBe(200);
    expect((respuesta.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: null,
      diasEfectivos: 30,
      origen: 'PREDETERMINADO',
    });
  });

  it('fija los dias de un area: 200, queda propia y la subarea la hereda', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe();

    const fijada = await autorizar(request(app).put(`${BASE}/areas/10/dias`), token).send({ diasVacaciones: 40 });
    expect(fijada.status).toBe(200);
    expect((fijada.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: 40,
      diasEfectivos: 40,
      origen: 'PROPIO',
    });

    const subarea = await autorizar(request(app).get(`${BASE}/areas/11/dias`), token);
    expect((subarea.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: null,
      diasEfectivos: 40,
      origen: 'HEREDADO',
    });
  });

  it('acepta medios dias y null, que quita el valor propio', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe();
    const medio = await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send({ diasVacaciones: 35.5 });
    expect((medio.body as CuerpoConfiguracion).configuracion.diasEfectivos).toBe(35.5);

    const quitada = await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send({ diasVacaciones: null });
    expect(quitada.status).toBe(200);
    expect((quitada.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: null,
      diasEfectivos: 30,
      origen: 'PREDETERMINADO',
    });
  });

  it('deja constancia de quien hizo el cambio', async () => {
    const { app, constancias } = crearEscenario();
    await autorizar(request(app).put(`${BASE}/areas/11/dias`), await tokenDe()).send({ diasVacaciones: 35 });
    expect(constancias).toEqual([
      { empresaId: 5, actorId: ID_SUPERADMIN, entidad: 'areas', entidadId: 11, antes: null, despues: 35 },
    ]);
  });

  it('un area de otro hospital o que no existe responde 404, al consultar y al cambiar', async () => {
    const { app, areas, constancias } = crearEscenario();
    const token = await tokenDe();
    for (const id of [20, 999]) {
      const consulta = await autorizar(request(app).get(`${BASE}/areas/${String(id)}/dias`), token);
      expect(consulta.status).toBe(404);
      const cambio = await autorizar(request(app).put(`${BASE}/areas/${String(id)}/dias`), token).send({
        diasVacaciones: 35,
      });
      expect(cambio.status).toBe(404);
    }
    expect(areas.get(20)?.diasVacaciones).toBeNull();
    expect(constancias).toHaveLength(0);
  });

  it('el SUPERADMIN de otro hospital no ve las areas de este', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/areas/10/dias`), await tokenDe('SUPERADMIN', 6));
    expect(respuesta.status).toBe(404);
  });
});

describe('personas', () => {
  it('fija los dias de una persona: 200 y manda sobre los de su area', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe();
    await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send({ diasVacaciones: 35 });

    const fijada = await autorizar(request(app).put(`${BASE}/usuarios/1/dias`), token).send({ diasVacaciones: 28 });
    expect(fijada.status).toBe(200);
    expect((fijada.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: 28,
      diasEfectivos: 28,
      origen: 'PROPIO',
    });

    const consulta = await autorizar(request(app).get(`${BASE}/usuarios/1/dias`), token);
    expect((consulta.body as CuerpoConfiguracion).configuracion.origen).toBe('PROPIO');
  });

  it('sin dias propios, la persona hereda los de su area', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe();
    await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send({ diasVacaciones: 35 });
    const consulta = await autorizar(request(app).get(`${BASE}/usuarios/1/dias`), token);
    expect((consulta.body as CuerpoConfiguracion).configuracion).toEqual({
      diasVacaciones: null,
      diasEfectivos: 35,
      origen: 'HEREDADO',
    });
  });

  it('una persona que no existe, o es de otro hospital, responde 404', async () => {
    const { app } = crearEscenario();
    const consulta = await autorizar(request(app).get(`${BASE}/usuarios/999/dias`), await tokenDe());
    expect(consulta.status).toBe(404);
    const ajeno = await autorizar(
      request(app).put(`${BASE}/usuarios/1/dias`),
      await tokenDe('SUPERADMIN', 6),
    ).send({ diasVacaciones: 28 });
    expect(ajeno.status).toBe(404);
  });
});

describe('validacion', () => {
  it('rechaza dias invalidos y campos que no existen, y no cambia nada', async () => {
    const { app, areas, constancias } = crearEscenario();
    const token = await tokenDe();
    const invalidos = [
      { diasVacaciones: 0 },
      { diasVacaciones: -5 },
      { diasVacaciones: 367 },
      { diasVacaciones: 10.3 },
      { diasVacaciones: '30' },
      {},
      { diasVacaciones: 30, empresaId: 6 },
    ];
    for (const cuerpo of invalidos) {
      const respuesta = await autorizar(request(app).put(`${BASE}/areas/11/dias`), token).send(cuerpo);
      expect(respuesta.status).toBe(400);
      expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
    }
    expect(areas.get(11)?.diasVacaciones).toBeNull();
    expect(constancias).toHaveLength(0);
  });

  it('responde 400 si el id no es un numero', async () => {
    const { app } = crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/areas/abc/dias`), await tokenDe());
    expect(respuesta.status).toBe(400);
  });
});