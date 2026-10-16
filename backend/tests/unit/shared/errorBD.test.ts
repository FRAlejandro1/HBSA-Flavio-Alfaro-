// Pruebas de errorBD: traduccion de los errores de MySQL que el usuario puede provocar.
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/shared/errors/AppError';
import { traducirErrorBD } from '../../../src/shared/errors/errorBD';

describe('traducirErrorBD', () => {
  it('traduce un duplicado a conflicto con el mensaje del recurso', () => {
    const error = traducirErrorBD({ code: 'ER_DUP_ENTRY' }, { duplicado: 'Ya existe un area' });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'CONFLICTO', estado: 409, message: 'Ya existe un area' });
  });

  it('traduce un registro referenciado a conflicto', () => {
    const error = traducirErrorBD({ code: 'ER_ROW_IS_REFERENCED_2' }, { enUso: 'Esta en uso' });
    expect(error).toMatchObject({ codigo: 'CONFLICTO', message: 'Esta en uso' });
  });

  it('traduce una referencia inexistente a regla de negocio', () => {
    const error = traducirErrorBD({ code: 'ER_NO_REFERENCED_ROW_2' }, {});
    expect(error).toMatchObject({ codigo: 'REGLA_DE_NEGOCIO', estado: 422 });
  });

  it('devuelve el mismo error si no lo reconoce y convierte lo que no es Error', () => {
    const original = new Error('otro problema');
    expect(traducirErrorBD(original, {})).toBe(original);
    expect(traducirErrorBD('texto suelto', {})).toBeInstanceOf(Error);
  });
});