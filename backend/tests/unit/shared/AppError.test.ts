// Pruebas de AppError: estado HTTP por codigo y datos que conserva.
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/shared/errors/AppError';

describe('AppError', () => {
  it('es un Error con nombre y mensaje', () => {
    const error = AppError.noEncontrado('No existe');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('No existe');
  });

  it('asigna el estado HTTP segun el codigo', () => {
    expect(AppError.validacion('x').estado).toBe(400);
    expect(AppError.noAutenticado().estado).toBe(401);
    expect(AppError.prohibido().estado).toBe(403);
    expect(AppError.noEncontrado().estado).toBe(404);
    expect(AppError.conflicto('x').estado).toBe(409);
    expect(AppError.reglaDeNegocio('x').estado).toBe(422);
  });

  it('conserva los detalles recibidos', () => {
    const error = AppError.validacion('Datos invalidos', [{ campo: 'cedula' }]);
    expect(error.codigo).toBe('VALIDACION');
    expect(error.detalles).toEqual([{ campo: 'cedula' }]);
  });
});