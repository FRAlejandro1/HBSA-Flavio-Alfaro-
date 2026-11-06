// Pruebas unitarias del middleware de autorizacion por rol.
// Verifica acceso, rechazo por rol y ausencia de autenticacion.

import type { RequestHandler } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { authorizeRole } from '../../../src/middlewares/authorizeRole';
import { AppError } from '../../../src/shared/errors/AppError';
import type { CodigoRol } from '../../../src/shared/types/roles';

function ejecutarMiddleware(
  permitidos: CodigoRol[],
  usuario?: { rol: CodigoRol },
) {
  const req = { usuario } as unknown as Parameters<RequestHandler>[0];
  const res = {} as Parameters<RequestHandler>[1];
  const next = vi.fn();

  authorizeRole(...permitidos)(
    req,
    res,
    next,
  );

  return next;
}

describe('authorizeRole', () => {
  it('rechaza solicitudes sin usuario autenticado', () => {
    const next = ejecutarMiddleware(['SUPERADMIN']);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
  });

  it('rechaza usuarios cuyo rol no esta permitido', () => {
    const next = ejecutarMiddleware(
      ['SUPERADMIN'],
      { rol: 'EMPLEADO' },
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
  });

  it('permite continuar cuando el rol esta autorizado', () => {
    const next = ejecutarMiddleware(
      ['SUPERADMIN'],
      { rol: 'SUPERADMIN' },
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('rechaza el acceso cuando no se permiten roles', () => {
    const next = ejecutarMiddleware(
      [],
      { rol: 'SUPERADMIN' },
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
  });
});
