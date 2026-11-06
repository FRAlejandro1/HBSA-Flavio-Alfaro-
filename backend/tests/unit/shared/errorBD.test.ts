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

  it('cuando code existe pero no es una cadena conserva el error como desconocido', () => {
    const error = traducirErrorBD({ code: 123 }, {});

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('[object Object]');
  });

  it('convierte null en un Error cuando no existe un codigo reconocible', () => {
    const error = traducirErrorBD(null, {});

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('null');
  });

  it('utiliza el mensaje predeterminado para duplicados', () => {
    const error = traducirErrorBD({ code: 'ER_DUP_ENTRY' }, {});

    expect(error).toMatchObject({
      codigo: 'CONFLICTO',
      message: 'Ya existe un registro igual',
    });
  });

  it('utiliza el mensaje predeterminado para registros en uso', () => {
    const error = traducirErrorBD({ code: 'ER_ROW_IS_REFERENCED_2' }, {});

    expect(error).toMatchObject({
      codigo: 'CONFLICTO',
      message: 'El registro esta en uso y no se puede eliminar',
    });
  });

  it('utiliza el mensaje predeterminado para referencias invalidas', () => {
    const error = traducirErrorBD({ code: 'ER_NO_REFERENCED_ROW_2' }, {});

    expect(error).toMatchObject({
      codigo: 'REGLA_DE_NEGOCIO',
      message: 'Una referencia indicada no existe en este hospital',
    });
  });});
