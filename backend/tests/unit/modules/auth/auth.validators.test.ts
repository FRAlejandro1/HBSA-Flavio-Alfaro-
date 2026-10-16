// Pruebas de los esquemas de autenticacion: normalizacion y limites de la entrada.
import { describe, expect, it } from 'vitest';
import { esquemaLogin } from '../../../../src/modules/auth/auth.validators';

describe('esquemaLogin', () => {
  it('recorta y pasa a minusculas el correo', () => {
    const entrada = esquemaLogin.parse({ correo: '  Jefe@Hospital.TEST ', clave: 'abc' });
    expect(entrada.correo).toBe('jefe@hospital.test');
  });

  it('rechaza un correo con formato invalido', () => {
    expect(() => esquemaLogin.parse({ correo: 'no-es-un-correo', clave: 'abc' })).toThrow();
  });

  it('rechaza una clave vacia', () => {
    expect(() => esquemaLogin.parse({ correo: 'jefe@hospital.test', clave: '' })).toThrow();
  });

  it('rechaza una clave demasiado larga', () => {
    expect(() =>
      esquemaLogin.parse({ correo: 'jefe@hospital.test', clave: 'a'.repeat(129) }),
    ).toThrow();
  });

  it('rechaza campos faltantes', () => {
    expect(() => esquemaLogin.parse({})).toThrow();
  });
});