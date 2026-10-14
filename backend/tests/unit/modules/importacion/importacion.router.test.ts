
 // Pruebas HTTP del módulo importación: archivo multipart, permisos, huella, CSRF y límites.
 // Usa el router real con tokens reales, el lector de CSV real y un repositorio en memoria.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { crearAuthenticate } from '../../../../src/middlewares/authenticate';
import { CABECERA_CSRF, COOKIE_CSRF, csrf } from '../../../../src/middlewares/csrf';
import { errorHandler, rutaNoEncontrada } from '../../../../src/middlewares/errorHandler';
import { crearImportacionController } from '../../../../src/modules/importacion/importacion.controller';
import { crearImportacionRouter } from '../../../../src/modules/importacion/importacion.routes';
import { ImportacionService } from '../../../../src/modules/importacion/importacion.service';
import { leerTabla } from '../../../../src/modules/importacion/lectores';
import { tokensJwt } from '../../../../src/shared/security/tokens';
import type { CodigoRol } from '../../../../src/shared/types/roles';
import { crearSesionesEnMemoria } from '../../../helpers/auth';
import { crearImportacionEnMemoria, usuarioExistente } from '../../../helpers/importacion';

interface CuerpoError {
  codigo: string;
  mensaje: string;
}

interface CuerpoRevision {
  revision: {
    huella: string;
    puedeAplicar: boolean;
    resumen: { crear: number; actualizar: number; conErrores: number };
    columnas: { encabezado: string; campo: string | null }[];
    filas: { accion: string }[];
  };
}

interface CuerpoResultado {
  resultado: { creadas: number };
}

const CSRF = 'token-csrf-de-prueba';
const BASE = '/api/importacion/personal';

const CSV = [
  'Identificación;Nombres;Apellidos;Unidad;Puesto;Fecha de ingreso',
  '0200000001;Rosa;Mena;Emergencia;Medico;10/05/2021',
  '0102030405;Ana;Perez;Emergencia;Medico;01/03/2020',
].join('\n');

function crearEscenario() {
  const memoria = crearImportacionEnMemoria({
    areas: [{ id: 1, detalle: 'Emergencia' }],
    cargos: [{ id: 1, detalle: 'Médico' }],
    usuarios: [usuarioExistente()],
  });

  const { sesiones } = crearSesionesEnMemoria();

  const servicio = new ImportacionService({
    repositorio: memoria.repositorio,
    leerTabla,
    hoy: () => '2026-10-13',
  });

  const router = crearImportacionRouter({
    controller: crearImportacionController(servicio),
    autenticar: crearAuthenticate(tokensJwt.verificarAcceso, sesiones),
  });

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Mantiene CSRF global para las demás rutas de la API.
  // Importación aplica su validación después de autenticar la sesión.
  app.use('/api', (req, res, next) => {
    const esImportacion =
      req.path === '/importacion' || req.path.startsWith('/importacion/');

    if (esImportacion) {
      next();
      return;
    }

    csrf(req, res, next);
  });

  app.use('/api/importacion', router);
  app.use(rutaNoEncontrada);
  app.use(errorHandler);

  return { app, ...memoria };
}

async function tokenDe(rol: CodigoRol): Promise<string> {
  return tokensJwt.firmarAcceso({
    usuarioId: 99,
    empresaId: 5,
    rol,
    jti: `jti-${rol}`,
  });
}

function autorizar(prueba: request.Test, accessToken: string): request.Test {
  return prueba
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', `${COOKIE_CSRF}=${CSRF}`)
    .set(CABECERA_CSRF, CSRF);
}

describe('permisos', () => {
  it('exige sesión y rol de administrador o Talento Humano', async () => {
    const { app } = crearEscenario();

    const sinSesion = await request(app)
      .post(`${BASE}/revisar`)
      .attach('archivo', Buffer.from(CSV), 'personal.csv');

    expect(sinSesion.status).toBe(401);

    for (const rol of ['EMPLEADO', 'JEFE_AREA'] as const) {
      const respuesta = await autorizar(
        request(app).post(`${BASE}/revisar`),
        await tokenDe(rol),
      ).attach('archivo', Buffer.from(CSV), 'personal.csv');

      expect(respuesta.status).toBe(403);
    }
  });

  it('rechaza un POST autenticado sin token CSRF', async () => {
    const { app } = crearEscenario();

    const respuesta = await request(app)
      .post(`${BASE}/revisar`)
      .set('Authorization', `Bearer ${await tokenDe('TALENTO_HUMANO')}`)
      .attach('archivo', Buffer.from(CSV), 'personal.csv');

    expect(respuesta.status).toBe(403);
  });
});

describe('revisar', () => {
  it('reconoce las columnas, resume la revisión y no guarda nada', async () => {
    const { app, planesAplicados } = crearEscenario();

    const respuesta = await autorizar(
      request(app).post(`${BASE}/revisar`),
      await tokenDe('TALENTO_HUMANO'),
    ).attach('archivo', Buffer.from(CSV), 'personal.csv');

    const { revision } = respuesta.body as CuerpoRevision;

    expect(respuesta.status).toBe(200);
    expect(revision.resumen).toMatchObject({
      crear: 1,
      actualizar: 0,
      conErrores: 0,
    });
    expect(revision.columnas.map((columna) => columna.campo)).toEqual([
      'cedula',
      'nombres',
      'apellidos',
      'area',
      'cargo',
      'fechaIngreso',
    ]);
    expect(revision.puedeAplicar).toBe(true);
    expect(planesAplicados).toHaveLength(0);
  });

  it('acepta un mapeo manual de columnas', async () => {
    const { app } = crearEscenario();

    const csv = [
      'Doc;Nombres;Apellidos;Unidad;Puesto;Fecha de ingreso',
      '0200000001;Rosa;Mena;Emergencia;Medico;10/05/2021',
    ].join('\n');

    const respuesta = await autorizar(
      request(app).post(`${BASE}/revisar`),
      await tokenDe('TALENTO_HUMANO'),
    )
      .field('mapeo', JSON.stringify({ cedula: 'Doc' }))
      .attach('archivo', Buffer.from(csv), 'personal.csv');

    expect(respuesta.status).toBe(200);
    expect((respuesta.body as CuerpoRevision).revision.resumen.crear).toBe(1);
  });

  it('responde 400 si el mapeo no es JSON válido, falta el archivo o el formato no se admite', async () => {
    const { app } = crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const mapeoMalo = await autorizar(
      request(app).post(`${BASE}/revisar`),
      token,
    )
      .field('mapeo', 'esto no es json')
      .attach('archivo', Buffer.from(CSV), 'personal.csv');

    expect(mapeoMalo.status).toBe(400);

    const sinArchivo = await autorizar(
      request(app).post(`${BASE}/revisar`),
      token,
    ).field('bajaAusentes', 'false');

    expect(sinArchivo.status).toBe(400);
    expect((sinArchivo.body as CuerpoError).mensaje).toMatch(/Falta el archivo/);

    const formato = await autorizar(
      request(app).post(`${BASE}/revisar`),
      token,
    ).attach('archivo', Buffer.from('x'), 'personal.pdf');

    expect(formato.status).toBe(400);
  });

  it('responde 400 si el archivo supera los 5 MB', async () => {
    const { app } = crearEscenario();
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');

    const respuesta = await autorizar(
      request(app).post(`${BASE}/revisar`),
      await tokenDe('TALENTO_HUMANO'),
    ).attach('archivo', grande, 'personal.csv');

    expect(respuesta.status).toBe(400);
    expect((respuesta.body as CuerpoError).mensaje).toBe(
      'El archivo supera los 5 MB',
    );
  });
});

describe('aplicar', () => {
  it('aplica con la huella de la revisión', async () => {
    const { app, planesAplicados } = crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const revisada = await autorizar(
      request(app).post(`${BASE}/revisar`),
      token,
    ).attach('archivo', Buffer.from(CSV), 'personal.csv');

    const { huella } = (revisada.body as CuerpoRevision).revision;

    const respuesta = await autorizar(
      request(app).post(`${BASE}/aplicar`),
      token,
    )
      .field('huella', huella)
      .attach('archivo', Buffer.from(CSV), 'personal.csv');

    expect(respuesta.status).toBe(200);
    expect((respuesta.body as CuerpoResultado).resultado.creadas).toBe(1);
    expect(planesAplicados).toHaveLength(1);
  });

  it('responde 409 si el archivo cambió y 400 si la huella no tiene el formato correcto', async () => {
    const { app, planesAplicados } = crearEscenario();
    const token = await tokenDe('TALENTO_HUMANO');

    const revisada = await autorizar(
      request(app).post(`${BASE}/revisar`),
      token,
    ).attach('archivo', Buffer.from(CSV), 'personal.csv');

    const { huella } = (revisada.body as CuerpoRevision).revision;

    const distinto = await autorizar(
      request(app).post(`${BASE}/aplicar`),
      token,
    )
      .field('huella', huella)
      .attach(
        'archivo',
        Buffer.from(CSV.replace('Rosa', 'Rosita')),
        'personal.csv',
      );

    expect(distinto.status).toBe(409);

    const malaHuella = await autorizar(
      request(app).post(`${BASE}/aplicar`),
      token,
    )
      .field('huella', 'abc')
      .attach('archivo', Buffer.from(CSV), 'personal.csv');

    expect(malaHuella.status).toBe(400);
    expect(planesAplicados).toHaveLength(0);
  });
});
