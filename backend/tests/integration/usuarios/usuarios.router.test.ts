// Pruebas HTTP del modulo usuarios: permisos por rol, aislamiento entre hospitales, CSRF y errores.
// Usa el router real con tokens reales y un repositorio en memoria; no necesita MySQL ni Redis.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { crearUsuariosController } from '../../../src/modules/usuarios/usuarios.controller';
import { crearUsuariosRouter } from '../../../src/modules/usuarios/usuarios.routes';
import { UsuariosService } from '../../../src/modules/usuarios/usuarios.service';
import { tokensJwt } from '../../../src/shared/security/tokens';
import type { CodigoRol } from '../../../src/shared/types/roles';
import { crearSesionesEnMemoria } from '../../helpers/auth';
import { crearUsuariosEnMemoria } from '../../helpers/usuarios';

interface CuerpoError {
  codigo: string;
}
interface CuerpoUsuario {
  usuario: { id: number; nombres: string; estado: string; fechaBaja: string | null; tieneCuenta: boolean };
}
interface CuerpoLista {
  usuarios: { id: number }[];
  total: number;
  pagina: number;
  porPagina: number;
}

const CSRF = 'token-csrf-de-prueba';
const BASE = '/api/usuarios';

const datosNuevos = {
  cedula: '0102030405',
  nombres: 'Ana',
  apellidos: 'Perez',
  areaId: 1,
  cargoId: 1,
  fechaIngreso: '2020-03-01',
};

async function crearEscenario() {
  const memoria = crearUsuariosEnMemoria();
  const { sesiones } = crearSesionesEnMemoria();
  const servicio = new UsuariosService({
    repositorio: memoria.repositorio,
    hashear: (clave) => Promise.resolve(`hash:${clave}`),
  });

  const router = crearUsuariosRouter({
    controller: crearUsuariosController(servicio),
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrf);
  app.use(BASE, router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  // Una persona en cada hospital (5 es el hospital de las pruebas, 6 es el ajeno)
  const base = { ...datosNuevos, correo: null, telefono: null, rol: 'EMPLEADO' as const, jefeInmediatoId: null, passwordHash: null };
  const idPropio = await memoria.repositorio.crear(5, base);
  const idAjeno = await memoria.repositorio.crear(6, { ...base, cedula: '0999999999' });

  return { app, idPropio, idAjeno };
}

// Access token real para un rol, un hospital y una persona
async function tokenDe(rol: CodigoRol, empresaId = 5, usuarioId = 1): Promise<string> {
  return tokensJwt.firmarAcceso({ usuarioId, empresaId, rol, jti: `jti-${rol}-${empresaId}-${usuarioId}` });
}

// Agrega sesion y CSRF a una peticion
function autorizar(prueba: request.Test, accessToken: string): request.Test {
  return prueba
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', `${COOKIE_CSRF}=${CSRF}`)
    .set(CABECERA_CSRF, CSRF);
}

describe('permisos', () => {
  it('exige sesion', async () => {
    const { app } = await crearEscenario();
    expect((await request(app).get(BASE)).status).toBe(401);
  });

  it('un empleado y un jefe de area no pueden usar el modulo', async () => {
    const { app } = await crearEscenario();
    const empleado = await autorizar(request(app).get(BASE), await tokenDe('EMPLEADO'));
    const jefe = await autorizar(request(app).get(BASE), await tokenDe('JEFE_AREA'));
    expect(empleado.status).toBe(403);
    expect(jefe.status).toBe(403);
  });

  it('Talento Humano no puede crear un SUPERADMIN', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe('TALENTO_HUMANO')).send({
      ...datosNuevos,
      cedula: '0102030499',
      rol: 'SUPERADMIN',
    });
    expect(respuesta.status).toBe(403);
  });
});

describe('lectura', () => {
  it('lista solo las personas del hospital con paginacion', async () => {
    const { app, idPropio } = await crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}?busqueda=perez`), await tokenDe('TALENTO_HUMANO'));
    const cuerpo = respuesta.body as CuerpoLista;
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({ total: 1, pagina: 1, porPagina: 20 });
    expect(cuerpo.usuarios.map((u) => u.id)).toEqual([idPropio]);
  });

  it('rechaza un parametro de query desconocido', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}?orden=asc`), await tokenDe('SUPERADMIN'));
    expect(respuesta.status).toBe(400);
  });

  it('responde 404 al pedir una persona de otro hospital', async () => {
    const { app, idAjeno } = await crearEscenario();
    const respuesta = await autorizar(request(app).get(`${BASE}/${idAjeno}`), await tokenDe('TALENTO_HUMANO'));
    expect(respuesta.status).toBe(404);
  });
});

describe('creacion y edicion', () => {
  it('crea una persona, responde 201 y no filtra datos de la clave', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe('TALENTO_HUMANO')).send({
      ...datosNuevos,
      cedula: '0102030499',
      correo: 'nueva@hospital.test',
      clave: 'ClaveSegura-123',
    });
    const cuerpo = respuesta.body as CuerpoUsuario;
    expect(respuesta.status).toBe(201);
    expect(cuerpo.usuario.tieneCuenta).toBe(true);
    expect(JSON.stringify(respuesta.body)).not.toContain('ClaveSegura');
    expect(JSON.stringify(respuesta.body)).not.toContain('hash:');
  });

  it('rechaza un empresaId en el cuerpo', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe('SUPERADMIN')).send({
      ...datosNuevos,
      cedula: '0102030499',
      empresaId: 6,
    });
    expect(respuesta.status).toBe(400);
    expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
  });

  it('rechaza un POST sin token CSRF', async () => {
    const { app } = await crearEscenario();
    const respuesta = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${await tokenDe('SUPERADMIN')}`)
      .send({ ...datosNuevos, cedula: '0102030499' });
    expect(respuesta.status).toBe(403);
  });

  it('responde 422 si hay clave sin correo', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe('SUPERADMIN')).send({
      ...datosNuevos,
      cedula: '0102030499',
      clave: 'ClaveSegura-123',
    });
    expect(respuesta.status).toBe(422);
  });

  it('responde 409 si la cedula ya existe en el hospital', async () => {
    const { app } = await crearEscenario();
    const respuesta = await autorizar(request(app).post(BASE), await tokenDe('SUPERADMIN')).send(datosNuevos);
    expect(respuesta.status).toBe(409);
  });

  it('actualiza una persona propia y responde 404 con la ajena', async () => {
    const { app, idPropio, idAjeno } = await crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const propia = await autorizar(request(app).patch(`${BASE}/${idPropio}`), token).send({ nombres: 'Maria' });
    expect(propia.status).toBe(200);
    expect((propia.body as CuerpoUsuario).usuario.nombres).toBe('Maria');

    const ajena = await autorizar(request(app).patch(`${BASE}/${idAjeno}`), token).send({ nombres: 'Intruso' });
    expect(ajena.status).toBe(404);
  });
});

describe('baja y reactivacion', () => {
  it('da de baja, rechaza la baja repetida y reactiva', async () => {
    const { app, idPropio } = await crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const baja = await autorizar(request(app).post(`${BASE}/${idPropio}/baja`), token).send({
      fechaBaja: '2026-10-01',
    });
    expect(baja.status).toBe(200);
    expect((baja.body as CuerpoUsuario).usuario).toMatchObject({ estado: 'INACTIVO', fechaBaja: '2026-10-01' });

    const repetida = await autorizar(request(app).post(`${BASE}/${idPropio}/baja`), token);
    expect(repetida.status).toBe(409);

    const reactivada = await autorizar(request(app).post(`${BASE}/${idPropio}/reactivar`), token);
    expect(reactivada.status).toBe(200);
    expect((reactivada.body as CuerpoUsuario).usuario).toMatchObject({ estado: 'ACTIVO', fechaBaja: null });
  });

  it('nadie se da de baja a si mismo', async () => {
    const { app, idPropio } = await crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO', 5, idPropio);
    const respuesta = await autorizar(request(app).post(`${BASE}/${idPropio}/baja`), token);
    expect(respuesta.status).toBe(422);
  });
});