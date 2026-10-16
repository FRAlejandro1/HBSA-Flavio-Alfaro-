// Pruebas de los esquemas de organizacion: limpieza de datos y rechazo de campos no permitidos.
import { describe, expect, it } from 'vitest';
import {
  esquemaActualizarArea,
  esquemaCrearArea,
  esquemaCrearCargo,
  esquemaId,
} from '../../../../src/modules/organizacion/organizacion.validators';

describe('esquemaCrearArea', () => {
  it('recorta el nombre y deja el jefe en null por defecto', () => {
    expect(esquemaCrearArea.parse({ detalle: '  Emergencia ' })).toEqual({
      detalle: 'Emergencia',
      jefeId: null,
    });
  });

  it('rechaza un empresaId en el cuerpo', () => {
    expect(() => esquemaCrearArea.parse({ detalle: 'Emergencia', empresaId: 9 })).toThrow();
  });
});

describe('esquemaActualizarArea', () => {
  it('exige al menos un campo', () => {
    expect(() => esquemaActualizarArea.parse({})).toThrow();
  });

  it('permite quitar al jefe con null', () => {
    expect(esquemaActualizarArea.parse({ jefeId: null })).toEqual({ jefeId: null });
  });
});

describe('esquemaCrearCargo', () => {
  it('exige nombre, responsabilidad y funciones', () => {
    expect(() => esquemaCrearCargo.parse({ detalle: 'Medico' })).toThrow();
  });
});

describe('esquemaId', () => {
  it('convierte el texto en numero y rechaza lo que no es un id', () => {
    expect(esquemaId.parse({ id: '12' })).toEqual({ id: 12 });
    expect(() => esquemaId.parse({ id: 'abc' })).toThrow();
    expect(() => esquemaId.parse({ id: '0' })).toThrow();
  });
});