// Firma y verificacion de JWT con jose (HS256): token de acceso (corto, viaja en la cabecera)
// y token de refresh (largo, viaja solo en cookie httpOnly). Cada uno usa su propio secreto.
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import type { UsuarioAutenticado } from '../types/autenticacion';
import { ROLES } from '../types/roles';
import type { CodigoRol } from '../types/roles';
import { duracionASegundos } from '../utils/duraciones';

const EMISOR = 'hbsa-backend';
const AUDIENCIA = 'hbsa-api';

// Se calculan al importar: si el formato de la duracion es invalido, el servidor no arranca
export const TTL_ACCESO_SEGUNDOS = duracionASegundos(env.JWT_ACCESS_TTL);
export const TTL_REFRESH_SEGUNDOS = duracionASegundos(env.JWT_REFRESH_TTL);

const claveAcceso = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const claveRefresh = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

// Forma exacta que debe tener cada tipo de token; cualquier otra se rechaza
const esquemaAcceso = z.object({
  sub: z.string().regex(/^\d+$/),
  jti: z.string().min(1),
  exp: z.number().int(),
  emp: z.number().int().positive(),
  rol: z.enum(ROLES),
  tipo: z.literal('acceso'),
});

const esquemaRefresh = z.object({
  sub: z.string().regex(/^\d+$/),
  jti: z.string().min(1),
  tipo: z.literal('refresh'),
});

export interface DatosAcceso {
  usuarioId: number;
  empresaId: number;
  rol: CodigoRol;
  jti: string;
}

export interface DatosRefresh {
  usuarioId: number;
  jti: string;
}

// Contrato que consumen los services y middlewares: asi las pruebas pueden usar un doble
export interface ITokens {
  firmarAcceso: (datos: DatosAcceso) => Promise<string>;
  firmarRefresh: (datos: DatosRefresh) => Promise<string>;
  verificarAcceso: (token: string) => Promise<UsuarioAutenticado>;
  verificarRefresh: (token: string) => Promise<DatosRefresh>;
}

export async function firmarAcceso(datos: DatosAcceso): Promise<string> {
  return new SignJWT({ emp: datos.empresaId, rol: datos.rol, tipo: 'acceso' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(datos.usuarioId))
    .setJti(datos.jti)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${TTL_ACCESO_SEGUNDOS}s`)
    .sign(claveAcceso);
}

export async function firmarRefresh(datos: DatosRefresh): Promise<string> {
  return new SignJWT({ tipo: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(datos.usuarioId))
    .setJti(datos.jti)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${TTL_REFRESH_SEGUNDOS}s`)
    .sign(claveRefresh);
}

// Verifica firma, algoritmo, emisor, audiencia y vencimiento; ante cualquier fallo responde lo mismo
async function verificar(token: string, clave: Uint8Array): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, clave, {
      algorithms: ['HS256'],
      issuer: EMISOR,
      audience: AUDIENCIA,
    });
    return payload;
  } catch {
    throw AppError.noAutenticado('Sesion no valida');
  }
}

export async function verificarAcceso(token: string): Promise<UsuarioAutenticado> {
  const resultado = esquemaAcceso.safeParse(await verificar(token, claveAcceso));
  if (!resultado.success) {
    throw AppError.noAutenticado('Sesion no valida');
  }
  const datos = resultado.data;
  return {
    id: Number.parseFloat(datos.sub),
    empresaId: datos.emp,
    rol: datos.rol,
    jti: datos.jti,
    expira: datos.exp,
  };
}

export async function verificarRefresh(token: string): Promise<DatosRefresh> {
  const resultado = esquemaRefresh.safeParse(await verificar(token, claveRefresh));
  if (!resultado.success) {
    throw AppError.noAutenticado('Sesion no valida');
  }
  return { usuarioId: Number.parseFloat(resultado.data.sub), jti: resultado.data.jti };
}

// Implementacion real de ITokens
export const tokensJwt: ITokens = { firmarAcceso, firmarRefresh, verificarAcceso, verificarRefresh };