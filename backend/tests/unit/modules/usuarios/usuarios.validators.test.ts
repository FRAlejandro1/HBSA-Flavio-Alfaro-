// Pruebas de los esquemas de usuarios: normalizacion, valores por defecto y rechazo de campos no permitidos.
import { describe, expect, it } from 'vitest';
import {
  esquemaActualizarUsuario,
  esquemaBaja,
  esquemaCrearUsuario,
  esquemaFiltrosUsuarios,
} from '../../../../src/modules/usuarios/usuarios.validators';

const base = {
  cedula: '0102030405',
  nombres: ' Ana ',
  apellidos: 'Perez',
  areaId: 1,
  cargoId: 1,
  fechaIngreso: '2020-03-01',
};

describe('esquemaCrearUsuario', () => {
  it('recorta los textos y aplica rol EMPLEADO y jefe null por defecto', () => {
    const entrada = esquemaCrearUsuario.parse(base);
    expect(entrada).toMatchObject({ nombres: 'Ana', rol: 'EMPLEADO', jefeInmediatoId: null });
  });

  it('normaliza el correo a minusculas', () => {
    const entrada = esquemaCrearUsuario.parse({ ...base, correo: ' Ana@Hospital.TEST ' });
    expect(entrada.correo).toBe('ana@hospital.test');
  });

  it('rechaza una cedula que no tiene 10 digitos', () => {
    expect(() => esquemaCrearUsuario.parse({ ...base, cedula: '123' })).toThrow();
    expect(() => esquemaCrearUsuario.parse({ ...base, cedula: '01020304AB' })).toThrow();
  });

  it('rechaza una fecha inexistente', () => {
    expect(() => esquemaCrearUsuario.parse({ ...base, fechaIngreso: '2026-02-31' })).toThrow();
  });

  it('rechaza una clave demasiado corta', () => {
    expect(() => esquemaCrearUsuario.parse({ ...base, clave: 'corta' })).toThrow();
  });

  it('rechaza un empresaId y un rol desconocido', () => {
    expect(() => esquemaCrearUsuario.parse({ ...base, empresaId: 9 })).toThrow();
    expect(() => esquemaCrearUsuario.parse({ ...base, rol: 'DIOS' })).toThrow();
  });
});

describe('esquemaActualizarUsuario', () => {
  it('exige al menos un campo', () => {
    expect(() => esquemaActualizarUsuario.parse({})).toThrow();
  });

  it('permite quitar el correo, el jefe y la clave con null', () => {
    expect(esquemaActualizarUsuario.parse({ correo: null, jefeInmediatoId: null, clave: null })).toEqual({
      correo: null,
      jefeInmediatoId: null,
      clave: null,
    });
  });
});

describe('esquemaFiltrosUsuarios', () => {
  it('aplica pagina 1 y 20 por pagina por defecto', () => {
    expect(esquemaFiltrosUsuarios.parse({})).toEqual({ pagina: 1, porPagina: 20 });
  });

  it('convierte los textos de la URL en numeros', () => {
    const filtros = esquemaFiltrosUsuarios.parse({ areaId: '3', pagina: '2', porPagina: '50' });
    expect(filtros).toMatchObject({ areaId: 3, pagina: 2, porPagina: 50 });
  });

  it('rechaza mas de 100 por pagina y parametros desconocidos', () => {
    expect(() => esquemaFiltrosUsuarios.parse({ porPagina: '500' })).toThrow();
    expect(() => esquemaFiltrosUsuarios.parse({ orden: 'asc' })).toThrow();
  });
});

describe('esquemaBaja', () => {
  it('acepta que no haya cuerpo', () => {
    expect(esquemaBaja.parse(undefined)).toEqual({});
  });

  it('valida la fecha de baja', () => {
    expect(esquemaBaja.parse({ fechaBaja: '2026-10-01' })).toEqual({ fechaBaja: '2026-10-01' });
    expect(() => esquemaBaja.parse({ fechaBaja: 'ayer' })).toThrow();
  });
});