// Operaciones de autenticación. No almacena el token de acceso en almacenamiento persistente.
import {
  establecerTokenAcceso,
  obtenerTokenCsrf,
  peticionApi,
} from '@/api/http';
import type {
  RespuestaLogin,
  RespuestaRefresco,
  RespuestaSesion,
  UsuarioAutenticado,
} from '@/features/auth/auth.types';

export async function iniciarSesion(
  correo: string,
  clave: string,
): Promise<UsuarioAutenticado> {
  await obtenerTokenCsrf();

  const resultado = await peticionApi<RespuestaLogin>('/api/auth/login', {
    method: 'POST',
    body: { correo, clave },
  });

  establecerTokenAcceso(resultado.accessToken);
  return resultado.usuario;
}

export async function restaurarSesion(): Promise<UsuarioAutenticado | null> {
  try {
    await obtenerTokenCsrf();

    const resultado = await peticionApi<RespuestaRefresco>('/api/auth/refresh', {
      method: 'POST',
      body: {},
    });

    establecerTokenAcceso(resultado.accessToken);

    const sesion = await peticionApi<RespuestaSesion>('/api/auth/me', {
      autenticada: true,
    });

    return sesion.usuario;
  } catch {
    establecerTokenAcceso(null);
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  try {
    await peticionApi<void>('/api/auth/logout', {
      method: 'POST',
      autenticada: true,
      body: {},
    });
  } finally {
    establecerTokenAcceso(null);
  }
}
