// Pruebas HTTP del modulo auth: CSRF, cookies, login, refresh con rotacion, logout y /me.
// Usa Supertest con el router real y dobles en memoria; no necesita MySQL ni Redis.
import cookieParser from 'cookie-parser';
import express from 'express';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAuthenticate } from '../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../src/middlewares/errorHandler';
import { crearAuthController } from '../../../src/modules/auth/auth.controller';
import { crearAuthRouter } from '../../../src/modules/auth/auth.routes';
import { AuthService } from '../../../src/modules/auth/auth.service';
import {
  TTL_ACCESO_SEGUNDOS,
  TTL_REFRESH_SEGUNDOS,
  tokensJwt,
} from '../../../src/shared/security/tokens';
import {
  crearClavesFalsas,
  crearRepositorioEnMemoria,
  crearSesionesEnMemoria,
} from '../../helpers/auth';
import type { UsuarioDePrueba } from '../../helpers/auth';

const CLAVE = 'clave-correcta-123';

const jefe: UsuarioDePrueba = {
  id: 7,
  empresaId: 5,
  rol: 'JEFE_AREA',
  correo: 'jefe@hospital.test',
  clave: CLAVE,
  activo: true,
  tokenId: null,
};

interface CuerpoSesion {
  accessToken: string;
  expiraEn: number;
  usuario: { id: number; correo: string; rol: string; empresa: { id: number; nombre: string } };
}

interface CuerpoError {
  codigo: string;
  mensaje: string;
}

// El limitador real se sustituye por uno que deja pasar: sus pruebas son de rateLimit, no de auth
const sinLimite: RequestHandler = (_req, _res, next) => {
  next();
};

function crearAppDePrueba(): express.Express {
  const { repositorio } = crearRepositorioEnMemoria([jefe]);
  const { sesiones } = crearSesionesEnMemoria();
  const { claves } = crearClavesFalsas();

  const servicio = new AuthService({
    repositorio,
    tokens: tokensJwt,
    claves,
    sesiones,
    ttlAccesoSegundos: TTL_ACCESO_SEGUNDOS,
  });
  const controller = crearAuthController(servicio, {
    secure: false,
    ttlRefreshSegundos: TTL_REFRESH_SEGUNDOS,
  });
  const router = crearAuthRouter({
    controller,
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
    limitadorAutenticacion: sinLimite,
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrf);
  app.use('/api/auth', router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);
  return app;
}

// Obtiene el token CSRF e inicia sesion con un agente que conserva las cookies
async function iniciarSesion(app: express.Express) {
  const agente = request.agent(app);
  const respuestaCsrf = await agente.get('/api/auth/csrf');
  const { csrfToken } = respuestaCsrf.body as { csrfToken: string };

  const respuesta = await agente
    .post('/api/auth/login')
    .set(CABECERA_CSRF, csrfToken)
    .send({ correo: jefe.correo, clave: CLAVE });

  return {
    agente,
    csrfToken,
    respuesta,
    sesion: respuesta.body as CuerpoSesion,
    cookies: respuesta.headers['set-cookie'] as unknown as string[],
  };
}

describe('GET /api/auth/csrf', () => {
  it('entrega el token en el cuerpo y en una cookie httpOnly', async () => {
    const app = crearAppDePrueba();
    const respuesta = await request(app).get('/api/auth/csrf');
    const { csrfToken } = respuesta.body as { csrfToken: string };
    const cookies = respuesta.headers['set-cookie'] as unknown as string[];

    expect(respuesta.status).toBe(200);
    expect(csrfToken.length).toBeGreaterThanOrEqual(43);
    expect(cookies.some((c) => c.startsWith(`${COOKIE_CSRF}=${csrfToken}`) && c.includes('HttpOnly'))).toBe(
      true,
    );
    expect(respuesta.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/auth/login', () => {
  it('rechaza el login sin token CSRF', async () => {
    const app = crearAppDePrueba();
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: jefe.correo, clave: CLAVE });
    expect(respuesta.status).toBe(403);
    expect((respuesta.body as CuerpoError).codigo).toBe('PROHIBIDO');
  });

  it('inicia sesion y entrega el refresh solo en una cookie segura', async () => {
    const app = crearAppDePrueba();
    const { respuesta, sesion, cookies } = await iniciarSesion(app);

    expect(respuesta.status).toBe(200);
    expect(sesion.expiraEn).toBe(900);
    expect(sesion.usuario).toMatchObject({ id: 7, correo: jefe.correo, rol: 'JEFE_AREA' });
    expect(JSON.stringify(respuesta.body)).not.toContain('refreshToken');

    const cookieRefresh = cookies.find((c) => c.startsWith('hbsa_refresh='));
    expect(cookieRefresh).toContain('HttpOnly');
    expect(cookieRefresh).toContain('Path=/api/auth');
    expect(cookieRefresh).toContain('SameSite=Strict');
  });

  it('responde 401 con mensaje generico ante una clave incorrecta', async () => {
    const app = crearAppDePrueba();
    const agente = request.agent(app);
    const { csrfToken } = (await agente.get('/api/auth/csrf')).body as { csrfToken: string };

    const respuesta = await agente
      .post('/api/auth/login')
      .set(CABECERA_CSRF, csrfToken)
      .send({ correo: jefe.correo, clave: 'incorrecta' });

    expect(respuesta.status).toBe(401);
    expect((respuesta.body as CuerpoError).mensaje).toBe('Correo o clave incorrectos');
  });

  it('responde 400 si el cuerpo no es valido', async () => {
    const app = crearAppDePrueba();
    const agente = request.agent(app);
    const { csrfToken } = (await agente.get('/api/auth/csrf')).body as { csrfToken: string };

    const respuesta = await agente
      .post('/api/auth/login')
      .set(CABECERA_CSRF, csrfToken)
      .send({ correo: 'no-es-correo', clave: CLAVE });

    expect(respuesta.status).toBe(400);
    expect((respuesta.body as CuerpoError).codigo).toBe('VALIDACION');
  });
});

describe('GET /api/auth/me', () => {
  it('exige token de acceso', async () => {
    const app = crearAppDePrueba();
    const respuesta = await request(app).get('/api/auth/me');
    expect(respuesta.status).toBe(401);
  });

  it('devuelve el perfil con un token valido', async () => {
    const app = crearAppDePrueba();
    const { agente, sesion } = await iniciarSesion(app);

    const respuesta = await agente
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sesion.accessToken}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ usuario: { id: 7, empresa: { id: 5 } } });
  });
});

describe('POST /api/auth/refresh', () => {
  it('entrega un access token nuevo y rota la cookie', async () => {
    const app = crearAppDePrueba();
    const { agente, csrfToken, sesion } = await iniciarSesion(app);

    const primero = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);
    const segundo = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);

    expect(primero.status).toBe(200);
    expect((primero.body as CuerpoSesion).accessToken).not.toBe(sesion.accessToken);
    // Cada refresh deja una cookie nueva, asi que el siguiente tambien funciona
    expect(segundo.status).toBe(200);
  });

  it('rechaza la peticion si no hay cookie de refresh', async () => {
    const app = crearAppDePrueba();
    const agente = request.agent(app);
    const { csrfToken } = (await agente.get('/api/auth/csrf')).body as { csrfToken: string };

    const respuesta = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);
    expect(respuesta.status).toBe(401);
  });

  it('cierra la sesion si se reutiliza una cookie de refresh ya rotada', async () => {
    const app = crearAppDePrueba();
    const { agente, csrfToken, cookies } = await iniciarSesion(app);
    const refreshViejo = /hbsa_refresh=([^;]+)/.exec(cookies.join(';'))?.[1];
    expect(refreshViejo).toBeDefined();

    const rotacion = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);
    expect(rotacion.status).toBe(200);

    // Alguien presenta la cookie anterior: debe rechazarse
    const reuso = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`${COOKIE_CSRF}=${csrfToken}`, `hbsa_refresh=${refreshViejo ?? ''}`])
      .set(CABECERA_CSRF, csrfToken);
    expect(reuso.status).toBe(401);

    // Y la sesion legitima tambien queda cerrada
    const trasReuso = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);
    expect(trasReuso.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('exige token de acceso', async () => {
    const app = crearAppDePrueba();
    const agente = request.agent(app);
    const { csrfToken } = (await agente.get('/api/auth/csrf')).body as { csrfToken: string };

    const respuesta = await agente.post('/api/auth/logout').set(CABECERA_CSRF, csrfToken);
    expect(respuesta.status).toBe(401);
  });

  it('revoca el access token, borra la cookie e impide refrescar', async () => {
    const app = crearAppDePrueba();
    const { agente, csrfToken, sesion } = await iniciarSesion(app);

    const cierre = await agente
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .set(CABECERA_CSRF, csrfToken);
    expect(cierre.status).toBe(204);

    const conTokenViejo = await agente
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sesion.accessToken}`);
    expect(conTokenViejo.status).toBe(401);
    expect((conTokenViejo.body as CuerpoError).mensaje).toBe('Sesion cerrada');

    const refrescar = await agente.post('/api/auth/refresh').set(CABECERA_CSRF, csrfToken);
    expect(refrescar.status).toBe(401);
  });
});