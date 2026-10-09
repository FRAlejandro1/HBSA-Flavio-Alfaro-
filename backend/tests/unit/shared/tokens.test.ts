// Pruebas de tokens: firma, verificacion y rechazo de tokens manipulados, vencidos o del tipo equivocado.
// Los secretos de pruebas vienen de vitest.config.ts.
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  TTL_ACCESO_SEGUNDOS,
  TTL_REFRESH_SEGUNDOS,
  firmarAcceso,
  firmarRefresh,
  verificarAcceso,
  verificarRefresh,
} from '../../../src/shared/security/tokens';

const CLAVE_ACCESO = new TextEncoder().encode('secreto-de-acceso-solo-para-pruebas-0001');
const datosAcceso = { usuarioId: 3, empresaId: 5, rol: 'JEFE_AREA', jti: 'jti-1' } as const;

describe('token de acceso', () => {
  it('se firma y se verifica devolviendo los datos del usuario', async () => {
    const token = await firmarAcceso(datosAcceso);
    const usuario = await verificarAcceso(token);
    expect(usuario).toMatchObject({ id: 3, empresaId: 5, rol: 'JEFE_AREA', jti: 'jti-1' });
    expect(usuario.expira).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rechaza un token con el contenido manipulado', async () => {
    const [cabecera, contenido, firma] = (await firmarAcceso(datosAcceso)).split('.');
    const original = JSON.parse(Buffer.from(contenido ?? '', 'base64url').toString()) as Record<
      string,
      unknown
    >;
    const alterado = Buffer.from(JSON.stringify({ ...original, rol: 'SUPERADMIN' })).toString(
      'base64url',
    );
    await expect(verificarAcceso(`${cabecera}.${alterado}.${firma}`)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('rechaza un token vencido', async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const vencido = await new SignJWT({ emp: 1, rol: 'EMPLEADO', tipo: 'acceso' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('3')
      .setJti('jti-vencido')
      .setIssuer('hbsa-backend')
      .setAudience('hbsa-api')
      .setIssuedAt(ahora - 3600)
      .setExpirationTime(ahora - 60)
      .sign(CLAVE_ACCESO);
    await expect(verificarAcceso(vencido)).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });

  it('rechaza un token de refresh usado como token de acceso', async () => {
    const refresh = await firmarRefresh({ usuarioId: 3, jti: 'jti-2' });
    await expect(verificarAcceso(refresh)).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });

  it('rechaza un texto que no es un token', async () => {
    await expect(verificarAcceso('esto-no-es-un-token')).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });
});

describe('token de refresh', () => {
  it('se firma y se verifica devolviendo usuario y jti', async () => {
    const token = await firmarRefresh({ usuarioId: 3, jti: 'jti-3' });
    expect(await verificarRefresh(token)).toEqual({ usuarioId: 3, jti: 'jti-3' });
  });

  it('rechaza un token de acceso usado como refresh', async () => {
    const acceso = await firmarAcceso(datosAcceso);
    await expect(verificarRefresh(acceso)).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });
});

describe('duraciones configuradas', () => {
  it('toman el valor de las variables de entorno', () => {
    expect(TTL_ACCESO_SEGUNDOS).toBe(900);
    expect(TTL_REFRESH_SEGUNDOS).toBe(604_800);
  });
});