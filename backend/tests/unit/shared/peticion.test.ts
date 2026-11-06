// Pruebas de las utilidades compartidas para leer datos de la petición.
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { exigirUsuario, leerIdParametro } from '../../../src/shared/http/peticion';
import type { UsuarioAutenticado } from '../../../src/shared/types/autenticacion';

function crearRequest(params: Record<string, unknown> = {}, usuario?: UsuarioAutenticado): Request {
  return {
    params,
    ...(usuario === undefined ? {} : { usuario }),
  } as Request;
}

describe('exigirUsuario', () => {
  it('devuelve el usuario autenticado', () => {
    const usuario: UsuarioAutenticado = {
      id: 10,
      empresaId: 5,
      rol: 'EMPLEADO',
      jti: 'jti-test',
      expira: 9_999_999_999,
    };

    expect(exigirUsuario(crearRequest({}, usuario))).toBe(usuario);
  });

  it('rechaza una petición sin usuario autenticado', () => {
    let error: unknown;

    try {
      exigirUsuario(crearRequest());
    } catch (e) {
      error = e;
    }

    expect(error).toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });
});

describe('leerIdParametro', () => {
  it('devuelve directamente un id numérico', () => {
    expect(leerIdParametro(crearRequest({ id: 25 }))).toBe(25);
  });

  it('convierte un parámetro string a número', () => {
    expect(leerIdParametro(crearRequest({ id: '42' }))).toBe(42);
  });

  it('rechaza un parámetro de tipo no válido', () => {
    let error: unknown;

    try {
      leerIdParametro(crearRequest({ id: null }));
    } catch (e) {
      error = e;
    }

    expect(error).toMatchObject({ codigo: 'VALIDACION' });
  });

  it('rechaza un string que no representa un número', () => {
    let error: unknown;

    try {
      leerIdParametro(crearRequest({ id: 'abc' }));
    } catch (e) {
      error = e;
    }

    expect(error).toMatchObject({ codigo: 'VALIDACION' });
  });
});