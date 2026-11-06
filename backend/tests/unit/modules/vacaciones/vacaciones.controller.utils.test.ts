import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../src/shared/errors/AppError';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import {
  obtenerActor,
  leerId,
} from '../../../../src/modules/vacaciones/vacaciones.controller.utils';

function crearRequest(usuario: unknown, id: unknown): Request {
  return {
    usuario,
    params: { id },
  } as unknown as Request;
}

describe('vacaciones.controller.utils', () => {
  describe('obtenerActor', () => {
    it('devuelve el usuario autenticado de la solicitud', () => {
      const actor = { id: 1 } as unknown as UsuarioAutenticado;
      const req = crearRequest(actor, '1');

      expect(obtenerActor(req)).toBe(actor);
    });

    it('rechaza solicitudes sin usuario autenticado', () => {
      const req = crearRequest(undefined, '1');

      expect(() => obtenerActor(req)).toThrow(AppError);
    });
  });

  describe('leerId', () => {
    it('devuelve el identificador cuando ya es numérico', () => {
      const req = crearRequest(undefined, 25);

      expect(leerId(req)).toBe(25);
    });

    it('convierte una cadena numérica a número', () => {
      const req = crearRequest(undefined, '25.5');

      expect(leerId(req)).toBe(25.5);
    });

    it('conserva el comportamiento de parseFloat para cadenas', () => {
      const req = crearRequest(undefined, '25abc');

      expect(leerId(req)).toBe(25);
    });

    it('rechaza cadenas que no contienen un identificador numérico', () => {
      const req = crearRequest(undefined, 'invalido');

      expect(() => leerId(req)).toThrow(AppError);
      expect(() => leerId(req)).toThrow('Identificador invalido');
    });

    it('rechaza valores que no son números ni cadenas', () => {
      const req = crearRequest(undefined, ['25']);

      expect(() => leerId(req)).toThrow(AppError);
    });
  });
});