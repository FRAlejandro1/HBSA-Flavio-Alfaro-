// Pruebas del service de autenticacion con dobles en memoria y tokens jose reales.
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { tokensJwt } from '../../../../src/shared/security/tokens';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import {
  crearClavesFalsas,
  crearRepositorioEnMemoria,
  crearSesionesEnMemoria,
} from '../../../helpers/auth';
import type { UsuarioDePrueba } from '../../../helpers/auth';

const CLAVE = 'clave-correcta-123';

const jefe: UsuarioDePrueba = {
  id: 7,
  empresaId: 5,
  rol: 'JEFE_AREA',
  correo: 'jefe@hospital.test',
  clave: CLAVE,
  activo: true,
  tokenId: null,
};

const sinCuenta: UsuarioDePrueba = {
  id: 8,
  empresaId: 5,
  rol: 'EMPLEADO',
  correo: 'sincuenta@hospital.test',
  clave: null,
  activo: true,
  tokenId: null,
};

const inactivo: UsuarioDePrueba = {
  id: 9,
  empresaId: 5,
  rol: 'EMPLEADO',
  correo: 'baja@hospital.test',
  clave: CLAVE,
  activo: false,
  tokenId: null,
};

// Arma el service con identificadores predecibles: id-1, id-2, ...
function crearEscenario() {
  const { repositorio, usuarios } = crearRepositorioEnMemoria([jefe, sinCuenta, inactivo]);
  const { sesiones, revocados } = crearSesionesEnMemoria();
  const { claves, gastarTiempo } = crearClavesFalsas();
  let contador = 0;

  const servicio = new AuthService({
    repositorio,
    tokens: tokensJwt,
    claves,
    sesiones,
    ttlAccesoSegundos: 900,
    generarId: () => {
      contador += 1;
      return `id-${contador}`;
    },
    ahora: () => 1_000_000_000_000,
  });

  return { servicio, usuarios, revocados, gastarTiempo };
}

describe('AuthService.login', () => {
  it('devuelve tokens y perfil, y guarda el jti del refresh', async () => {
    const { servicio, usuarios } = crearEscenario();
    const resultado = await servicio.login(jefe.correo, CLAVE);

    expect(resultado.expiraEn).toBe(900);
    expect(resultado.usuario).toMatchObject({ id: 7, rol: 'JEFE_AREA', correo: jefe.correo });
    expect(usuarios.get(7)?.tokenId).toBe('id-1');

    const acceso = await tokensJwt.verificarAcceso(resultado.accessToken);
    expect(acceso).toMatchObject({ id: 7, empresaId: 5, rol: 'JEFE_AREA' });
    expect(await tokensJwt.verificarRefresh(resultado.refreshToken)).toEqual({
      usuarioId: 7,
      jti: 'id-1',
    });
  });

  it('rechaza un correo inexistente gastando tiempo de verificacion', async () => {
    const { servicio, gastarTiempo } = crearEscenario();
    await expect(servicio.login('nadie@hospital.test', CLAVE)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
      message: 'Correo o clave incorrectos',
    });
    expect(gastarTiempo).toHaveBeenCalledTimes(1);
  });

  it('rechaza una clave incorrecta con el mismo mensaje', async () => {
    const { servicio, gastarTiempo } = crearEscenario();
    await expect(servicio.login(jefe.correo, 'otra-clave')).rejects.toThrow(
      'Correo o clave incorrectos',
    );
    expect(gastarTiempo).not.toHaveBeenCalled();
  });

  it('rechaza a un usuario de la plantilla sin cuenta', async () => {
    const { servicio, gastarTiempo } = crearEscenario();
    await expect(servicio.login(sinCuenta.correo, CLAVE)).rejects.toThrow(
      'Correo o clave incorrectos',
    );
    expect(gastarTiempo).toHaveBeenCalledTimes(1);
  });

  it('rechaza a un usuario dado de baja', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.login(inactivo.correo, CLAVE)).rejects.toThrow(
      'Correo o clave incorrectos',
    );
  });
});

describe('AuthService.refrescar', () => {
  it('rota el refresh y entrega tokens nuevos', async () => {
    const { servicio, usuarios } = crearEscenario();
    const sesion = await servicio.login(jefe.correo, CLAVE);
    const refresco = await servicio.refrescar(sesion.refreshToken);

    expect(refresco.expiraEn).toBe(900);
    expect(refresco.accessToken).not.toBe(sesion.accessToken);
    expect(usuarios.get(7)?.tokenId).toBe('id-3');
    expect(await tokensJwt.verificarRefresh(refresco.refreshToken)).toEqual({
      usuarioId: 7,
      jti: 'id-3',
    });
  });

  it('cierra la sesion si se reutiliza un refresh ya rotado', async () => {
    const { servicio, usuarios } = crearEscenario();
    const sesion = await servicio.login(jefe.correo, CLAVE);
    const refresco = await servicio.refrescar(sesion.refreshToken);

    await expect(servicio.refrescar(sesion.refreshToken)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
    expect(usuarios.get(7)?.tokenId).toBeNull();

    // El refresh nuevo tambien deja de servir: la sesion entera quedo cerrada
    await expect(servicio.refrescar(refresco.refreshToken)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('rechaza el refresh de un usuario dado de baja despues del login', async () => {
    const { servicio, usuarios } = crearEscenario();
    const sesion = await servicio.login(jefe.correo, CLAVE);
    const usuario = usuarios.get(7);
    if (usuario) {
      usuario.activo = false;
    }
    await expect(servicio.refrescar(sesion.refreshToken)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('rechaza un texto que no es un token', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.refrescar('no-es-un-token')).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });
});

describe('AuthService.cerrarSesion y obtenerPerfil', () => {
  const usuarioAutenticado: UsuarioAutenticado = {
    id: 7,
    empresaId: 5,
    rol: 'JEFE_AREA',
    jti: 'jti-acceso',
    // 600 segundos despues del instante fijo del service
    expira: 1_000_000_600,
  };

  it('revoca el access token por lo que le queda de vida y borra el jti del refresh', async () => {
    const { servicio, usuarios, revocados } = crearEscenario();
    await servicio.login(jefe.correo, CLAVE);

    await servicio.cerrarSesion(usuarioAutenticado);

    expect(revocados.get('jti-acceso')).toBe(600);
    expect(usuarios.get(7)?.tokenId).toBeNull();
  });

  it('impide refrescar despues de cerrar la sesion', async () => {
    const { servicio } = crearEscenario();
    const sesion = await servicio.login(jefe.correo, CLAVE);
    await servicio.cerrarSesion(usuarioAutenticado);

    await expect(servicio.refrescar(sesion.refreshToken)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('devuelve el perfil del usuario autenticado', async () => {
    const { servicio } = crearEscenario();
    const perfil = await servicio.obtenerPerfil(usuarioAutenticado);
    expect(perfil).toMatchObject({ id: 7, empresa: { id: 5 }, area: { detalle: 'Emergencia' } });
  });

  it('rechaza el perfil de un usuario que ya no existe', async () => {
    const { servicio } = crearEscenario();
    await expect(servicio.obtenerPerfil({ ...usuarioAutenticado, id: 99 })).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });
});