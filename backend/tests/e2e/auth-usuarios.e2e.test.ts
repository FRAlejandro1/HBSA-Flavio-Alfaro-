// E2E de la aplicacion completa con MySQL y Redis reales: login, gestion de personal, rotacion del refresh,
// revocacion al cerrar sesion, bajas y aislamiento entre hospitales. Usa Argon2 y JWT reales.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarBaseDatos } from '../../src/config/database';
import { cerrarRedis } from '../../src/config/redis';
import { CABECERA_CSRF, COOKIE_CSRF } from '../../src/middlewares/csrf';
import { hashearClave } from '../../src/shared/security/password';
import { IDS, insertarUsuario, limpiarRedis, resetearDatos } from '../helpers/baseDatos';

interface CuerpoSesion {
  accessToken: string;
  usuario: { rol: string };
}
interface CuerpoError {
  codigo: string;
  mensaje: string;
}
interface CuerpoUsuario {
  usuario: { id: number; estado: string };
}
interface CuerpoLista {
  total: number;
  usuarios: { apellidos: string }[];
}

const CLAVE_ADMIN = 'ClaveAdmin-12345';
const CLAVE_NUEVA = 'ClaveSegura-12345';
const app = crearApp();

// Persona para crear por la API; cada prueba cambia lo que necesita
function datosPersona(cedula: string, correo: string | null, cambios: Record<string, unknown> = {}) {
  return {
    cedula,
    nombres: 'Luis',
    apellidos: 'Gomez',
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    fechaIngreso: '2020-03-01',
    ...(correo === null ? {} : { correo, clave: CLAVE_NUEVA }),
    ...cambios,
  };
}

// Pide el token CSRF e inicia sesion con un agente que conserva las cookies
async function iniciarSesion(correo: string, clave: string) {
  const agente = request.agent(app);
  const { csrfToken } = (await agente.get('/api/auth/csrf')).body as { csrfToken: string };
  const respuesta = await agente
    .post('/api/auth/login')
    .set(CABECERA_CSRF, csrfToken)
    .send({ correo, clave });
  const cuerpo = respuesta.body as CuerpoSesion;
  return {
    agente,
    csrfToken,
    respuesta,
    accessToken: cuerpo.accessToken,
    cookies: respuesta.headers['set-cookie'] as unknown as string[] | undefined,
  };
}

// Agrega el access token y el CSRF a una peticion de un agente ya autenticado
function como(prueba: request.Test, csrfToken: string, accessToken: string): request.Test {
  return prueba.set('Authorization', `Bearer ${accessToken}`).set(CABECERA_CSRF, csrfToken);
}

beforeEach(async () => {
  await resetearDatos();
  await limpiarRedis();
  // Administrador del hospital A, con cuenta de acceso real
  await insertarUsuario({
    empresaId: IDS.empresaA,
    areaId: IDS.areaA1,
    cargoId: IDS.cargoA1,
    cedula: '0100000001',
    rol: 'SUPERADMIN',
    correo: 'admin@a.test',
    passwordHash: await hashearClave(CLAVE_ADMIN),
  });
});

afterAll(async () => {
  await cerrarBaseDatos();
  await cerrarRedis();
});

describe('acceso y gestion de personal', () => {
  it('el administrador inicia sesion, crea a Talento Humano y este tambien puede entrar', async () => {
    const admin = await iniciarSesion('admin@a.test', CLAVE_ADMIN);
    expect(admin.respuesta.status).toBe(200);

    const creada = await como(admin.agente.post('/api/usuarios'), admin.csrfToken, admin.accessToken).send(
      datosPersona('0102030405', 'th@a.test', { rol: 'TALENTO_HUMANO' }),
    );
    expect(creada.status).toBe(201);

    const th = await iniciarSesion('th@a.test', CLAVE_NUEVA);
    expect(th.respuesta.status).toBe(200);
    expect((th.respuesta.body as CuerpoSesion).usuario.rol).toBe('TALENTO_HUMANO');
  });

  it('Talento Humano gestiona personal pero no puede crear un SUPERADMIN', async () => {
    const admin = await iniciarSesion('admin@a.test', CLAVE_ADMIN);
    await como(admin.agente.post('/api/usuarios'), admin.csrfToken, admin.accessToken).send(
      datosPersona('0102030405', 'th@a.test', { rol: 'TALENTO_HUMANO' }),
    );
    const th = await iniciarSesion('th@a.test', CLAVE_NUEVA);

    const empleado = await como(th.agente.post('/api/usuarios'), th.csrfToken, th.accessToken).send(
      datosPersona('0102030406', null),
    );
    expect(empleado.status).toBe(201);

    const prohibido = await como(th.agente.post('/api/usuarios'), th.csrfToken, th.accessToken).send(
      datosPersona('0102030407', 'otro@a.test', { rol: 'SUPERADMIN' }),
    );
    expect(prohibido.status).toBe(403);
  });

  it('la busqueda encuentra a una persona sin distinguir tildes ni mayusculas', async () => {
    const admin = await iniciarSesion('admin@a.test', CLAVE_ADMIN);
    await como(admin.agente.post('/api/usuarios'), admin.csrfToken, admin.accessToken).send(
      datosPersona('0102030405', null, { apellidos: 'Pérez' }),
    );

    const respuesta = await como(
      admin.agente.get('/api/usuarios?busqueda=PEREZ'),
      admin.csrfToken,
      admin.accessToken,
    );
    const cuerpo = respuesta.body as CuerpoLista;
    expect(respuesta.status).toBe(200);
    expect(cuerpo.total).toBe(1);
    expect(cuerpo.usuarios[0]?.apellidos).toBe('Pérez');
  });

  it('una persona dada de baja ya no puede iniciar sesion', async () => {
    const admin = await iniciarSesion('admin@a.test', CLAVE_ADMIN);
    const creada = await como(admin.agente.post('/api/usuarios'), admin.csrfToken, admin.accessToken).send(
      datosPersona('0102030405', 'luis@a.test', { rol: 'JEFE_AREA' }),
    );
    const { usuario } = creada.body as CuerpoUsuario;

    const baja = await como(
      admin.agente.post(`/api/usuarios/${usuario.id}/baja`),
      admin.csrfToken,
      admin.accessToken,
    );
    expect(baja.status).toBe(200);
    expect((baja.body as CuerpoUsuario).usuario.estado).toBe('INACTIVO');

    const intento = await iniciarSesion('luis@a.test', CLAVE_NUEVA);
    expect(intento.respuesta.status).toBe(401);
    expect((intento.respuesta.body as CuerpoError).mensaje).toBe('Correo o clave incorrectos');
  });
});

describe('sesion', () => {
  it('el refresh rota y reutilizar uno anterior cierra la sesion', async () => {
    const sesion = await iniciarSesion('admin@a.test', CLAVE_ADMIN);
    const refreshViejo = /hbsa_refresh=([^;]+)/.exec((sesion.cookies ?? []).join(';'))?.[1] ?? '';
    expect(refreshViejo).not.toBe('');

    const rotacion = await sesion.agente.post('/api/auth/refresh').set(CABECERA_CSRF, sesion.csrfToken);
    expect(rotacion.status).toBe(200);

    const reuso = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`${COOKIE_CSRF}=${sesion.csrfToken}`, `hbsa_refresh=${refreshViejo}`])
      .set(CABECERA_CSRF, sesion.csrfToken);
    expect(reuso.status).toBe(401);

    const trasReuso = await sesion.agente.post('/api/auth/refresh').set(CABECERA_CSRF, sesion.csrfToken);
    expect(trasReuso.status).toBe(401);
  });

  it('cerrar sesion revoca el token de acceso en Redis y el refresh deja de servir', async () => {
    const sesion = await iniciarSesion('admin@a.test', CLAVE_ADMIN);

    const antes = await sesion.agente.get('/api/auth/me').set('Authorization', `Bearer ${sesion.accessToken}`);
    expect(antes.status).toBe(200);

    const cierre = await como(sesion.agente.post('/api/auth/logout'), sesion.csrfToken, sesion.accessToken);
    expect(cierre.status).toBe(204);

    const despues = await sesion.agente.get('/api/auth/me').set('Authorization', `Bearer ${sesion.accessToken}`);
    expect(despues.status).toBe(401);
    expect((despues.body as CuerpoError).mensaje).toBe('Sesion cerrada');

    const refresh = await sesion.agente.post('/api/auth/refresh').set(CABECERA_CSRF, sesion.csrfToken);
    expect(refresh.status).toBe(401);
  });
});

describe('aislamiento entre hospitales', () => {
  it('el administrador de un hospital no ve ni modifica personal del otro', async () => {
    const ajeno = await insertarUsuario({
      empresaId: IDS.empresaB,
      areaId: IDS.areaB1,
      cargoId: IDS.cargoB1,
      cedula: '0900000001',
      apellidos: 'Ajeno',
    });
    const admin = await iniciarSesion('admin@a.test', CLAVE_ADMIN);

    const verlo = await como(admin.agente.get(`/api/usuarios/${ajeno}`), admin.csrfToken, admin.accessToken);
    expect(verlo.status).toBe(404);

    const modificarlo = await como(
      admin.agente.patch(`/api/usuarios/${ajeno}`),
      admin.csrfToken,
      admin.accessToken,
    ).send({ nombres: 'Intruso' });
    expect(modificarlo.status).toBe(404);

    const lista = await como(
      admin.agente.get('/api/usuarios?busqueda=ajeno'),
      admin.csrfToken,
      admin.accessToken,
    );
    expect((lista.body as CuerpoLista).total).toBe(0);
  });
});