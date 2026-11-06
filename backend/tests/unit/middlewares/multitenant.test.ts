// Pruebas unitarias del aislamiento multitenant.
// Verifica autenticacion, asignacion y recuperacion del hospital.
import { describe, expect, it, vi } from 'vitest';
import type { Request, RequestHandler } from 'express';
import { multitenant, obtenerEmpresaId } from '../../../src/middlewares/multitenant';
import { AppError } from '../../../src/shared/errors/AppError';

describe('multitenant', () => {
  it('rechaza solicitudes sin usuario autenticado', () => {
    const req = {} as Request;
    const next = vi.fn();

    multitenant(
      req,
      {} as Parameters<RequestHandler>[1],
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
    expect(req.empresaId).toBeUndefined();
  });

  it('asigna el hospital del usuario autenticado y continua', () => {
    const req = {
      usuario: {
        id: 10,
        empresaId: 25,
        rol: 'SUPERADMIN',
      },
    } as unknown as Request;
    const next = vi.fn();

    multitenant(
      req,
      {} as Parameters<RequestHandler>[1],
      next,
    );

    expect(req.empresaId).toBe(25);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('obtiene el identificador del hospital asignado', () => {
    const req = { empresaId: 25 } as Request;

    expect(obtenerEmpresaId(req)).toBe(25);
  });

  it('lanza error de autenticacion si no se asigno el hospital', () => {
    const req = {} as Request;

    expect(() => obtenerEmpresaId(req)).toThrow(AppError);
  });
});