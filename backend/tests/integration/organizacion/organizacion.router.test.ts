// Pruebas HTTP del modulo organizacion: permisos por rol, aislamiento entre hospitales, CSRF y errores.
// Usa el router real con tokens reales y un repositorio en memoria; no necesita MySQL ni Redis.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { crearOrganizacionController } from '../../../src/modules/organizacion/organizacion.controller';
import { crearOrganizacionRouter } from '../../../src/modules/organizacion/organizacion.routes';
import { OrganizacionService } from '../../../src/modules/organizacion/organizacion.service';
import { tokensJwt } from '../../../src/shared/security/tokens';
import type { CodigoRol } from '../../../src/shared/types/roles';
import { crearSesionesEnMemoria } from '../../helpers/auth';
import { crearOrganizacionEnMemoria } from '../../helpers/organizacion';

interface CuerpoError {
  codigo: string;
}
interface CuerpoArea {
  area: { id: number; detalle: string; jefe: { id: number } | null };
}
interface CuerpoAreas {
  areas: { id: number; detalle: string }[];
}
interface CuerpoCargo {
  cargo: { id: number; detalle: string; funciones: string };
}

const CSRF = 'token-csrf-de-prueba';
const BASE = '/api/organizacion';
const cargoNuevo = { detalle: 'Medico', responsabilidad: 'Atender pacientes', funciones: 'Diagnosticar' };

async function crearEscenario() {
  const memoria = crearOrganizacionEnMemoria();
  const { sesiones } = crearSesionesEnMemoria();
  const servicio = new OrganizacionService(memoria.repositorio);

  const router = crearOrganizacionRouter({
    controller: crearOrganizacionController(servicio),
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrf);
  app.use(BASE, router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  // Un area en cada hospital (5 es el hospital de las pruebas, 6 es el ajeno)
  const idAreaPropia = await memoria.repositorio.crearArea(5, { detalle: 'Emergencia', jefeId: null });
  const idAreaAjena = await memoria.repositorio.crearArea(6, { detalle: 'Quirofano', jefeId: null });

  return { app, idAreaPropia, idAreaAjena, areasEnUso: memoria.areasEnUso };
}

// Access token real para un rol y un hospital
async function tokenDe(rol: CodigoRol, empresaId = 5): Promise<string> {
  return tokensJwt.firmarAcceso({ usuarioId: 1, empresaId, rol, jti: `jti-${rol}-${empresaId}` });
}

// Agrega sesion y CSRF a una peticion
function autorizar(prueba: request.Test, accessToken: string): request.Test {
  return prueba
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', `${COOKIE_CSRF}=${CSRF}`)
    .set(CABECERA_CSRF, CSRF);
}

describe('lectura', () => {
  it('exige sesion', async () => {
    const { app } = await crearEscenario();
    const respuesta = await request(app).get(`${BASE}/areas`);
    expect(respuesta.status).toBe(401);
  });

  it('un empleado ve solo las areas de su hospital', async () => {
    const { app, idAreaPropia } = await crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/areas`), await tokenDe('EMPLEADO'));
    const cuerpo = respuesta.body as CuerpoAreas;
    expect(respuesta.status).toBe(200);
    expect(cuerpo.areas.map((a) => a.id)).toEqual([idAreaPropia]);
  });

  it('un empleado ve la lista de cargos', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/cargos`), await tokenDe('EMPLEADO'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ cargos: [] });
  });
});

describe('areas', () => {
  it('un empleado no puede crear areas', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(`${BASE}/areas`), await tokenDe('EMPLEADO')).send({
      detalle: 'Nueva',
    });
    expect(respuesta.status).toBe(403);
  });

  it('Talento Humano no puede crear areas', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).post(`${BASE}/areas`),
      await tokenDe('TALENTO_HUMANO'),
    ).send({ detalle: 'Nueva' });
    expect(respuesta.status).toBe(403);
  });

  it('el SUPERADMIN crea un area y recibe 201 con el area completa', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).post(`${BASE}/areas`),
      await tokenDe('SUPERADMIN'),
    ).send({ detalle: '  Laboratorio ' });
    const cuerpo = respuesta.body as CuerpoArea;
    expect(respuesta.status).toBe(201);
    expect(cuerpo.area).toMatchObject({ detalle: 'Laboratorio', jefe: null });
  });

  it('rechaza un empresaId en el cuerpo', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).post(`${BASE}/areas`),
      await tokenDe('SUPERADMIN'),
    ).send({ detalle: 'Laboratorio', empresaId: 6 });
    expect(respuesta.status).toBe(400);
    expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
  });

  it('responde 409 ante un nombre duplicado', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).post(`${BASE}/areas`),
      await tokenDe('SUPERADMIN'),
    ).send({ detalle: 'Emergencia' });
    expect(respuesta.status).toBe(409);
    expect((respuesta.body as CuerpoError).codigo).toBe('CONFLICTO');
  });

  it('rechaza un POST sin token CSRF', async () => {
    const { app } = await crearEscenario();
    const respuesta = await request(app)
      .post(`${BASE}/areas`)
      .set('Authorization', `Bearer ${await tokenDe('SUPERADMIN')}`)
      .send({ detalle: 'Laboratorio' });
    expect(respuesta.status).toBe(403);
  });

  it('actualiza un area propia', async () => {
    const { app, idAreaPropia } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).patch(`${BASE}/areas/${idAreaPropia}`),
      await tokenDe('SUPERADMIN'),
    ).send({ detalle: 'Urgencias', jefeId: 3 });
    const cuerpo = respuesta.body as CuerpoArea;
    expect(respuesta.status).toBe(200);
    expect(cuerpo.area).toMatchObject({ detalle: 'Urgencias', jefe: { id: 3 } });
  });

  it('responde 404 al actualizar un area de otro hospital', async () => {
    const { app, idAreaAjena } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).patch(`${BASE}/areas/${idAreaAjena}`),
      await tokenDe('SUPERADMIN'),
    ).send({ detalle: 'Intruso' });
    expect(respuesta.status).toBe(404);
  });

  it('responde 400 si la actualizacion no trae campos', async () => {
    const { app, idAreaPropia } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).patch(`${BASE}/areas/${idAreaPropia}`),
      await tokenDe('SUPERADMIN'),
    ).send({});
    expect(respuesta.status).toBe(400);
  });

  it('elimina un area y deja de aparecer en la lista', async () => {
    const { app, idAreaPropia } = await crearEscenario();
    const token = await tokenDe('SUPERADMIN');
    const borrado = await autorizar(request(app).delete(`${BASE}/areas/${idAreaPropia}`), token);
    expect(borrado.status).toBe(204);

    const lista = await autorizar(request(app).get(`${BASE}/areas`), token);
    expect((lista.body as CuerpoAreas).areas).toEqual([]);
  });

  it('responde 409 al eliminar un area en uso', async () => {
    const { app, idAreaPropia, areasEnUso } = await crearEscenario();
    areasEnUso.add(idAreaPropia);
    const respuesta = await autorizar(
      request(app).delete(`${BASE}/areas/${idAreaPropia}`),
      await tokenDe('SUPERADMIN'),
    );
    expect(respuesta.status).toBe(409);
  });
});

describe('cargos', () => {
  it('un jefe de area no puede crear cargos', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(
      request(app).post(`${BASE}/cargos`),
      await tokenDe('JEFE_AREA'),
    ).send(cargoNuevo);
    expect(respuesta.status).toBe(403);
  });

  it('Talento Humano crea, actualiza y elimina cargos', async () => {
    const { app } = await crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const creado = await autorizar(request(app).post(`${BASE}/cargos`), token).send(cargoNuevo);
    const { cargo } = creado.body as CuerpoCargo;
    expect(creado.status).toBe(201);
    expect(cargo.detalle).toBe('Medico');

    const actualizado = await autorizar(request(app).patch(`${BASE}/cargos/${cargo.id}`), token).send({
      funciones: 'Operar',
    });
    expect(actualizado.status).toBe(200);
    expect((actualizado.body as CuerpoCargo).cargo).toMatchObject({
      detalle: 'Medico',
      funciones: 'Operar',
    });

    const borrado = await autorizar(request(app).delete(`${BASE}/cargos/${cargo.id}`), token);
    expect(borrado.status).toBe(204);
  });
});