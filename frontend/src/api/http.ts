// Cliente HTTP compartido. Centraliza credenciales, CSRF y errores de la API.
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

let tokenAcceso: string | null = null;
let tokenCsrf: string | null = null;

export function establecerTokenAcceso(token: string | null): void {
  tokenAcceso = token;
}

export function obtenerTokenAcceso(): string | null {
  return tokenAcceso;
}

async function leerMensajeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();

    if (typeof cuerpo === 'object' && cuerpo !== null) {
      const datos = cuerpo as Record<string, unknown>;
      const error = datos.error;

      if (typeof datos.mensaje === 'string') return datos.mensaje;
      if (typeof datos.message === 'string') return datos.message;
      if (typeof error === 'string') return error;

      if (typeof error === 'object' && error !== null) {
        const detalle = error as Record<string, unknown>;
        if (typeof detalle.message === 'string') return detalle.message;
        if (typeof detalle.mensaje === 'string') return detalle.mensaje;
      }
    }
  } catch {
    // La respuesta puede no contener JSON.
  }

  return respuesta.status === 429
    ? 'Demasiados intentos. Espere antes de volver a intentarlo.'
    : 'No se pudo completar la solicitud.';
}

export async function obtenerTokenCsrf(): Promise<string> {
  const respuesta = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) {
    throw new ErrorApi(await leerMensajeError(respuesta), respuesta.status);
  }

  const cuerpo: unknown = await respuesta.json();

  if (
    typeof cuerpo !== 'object' ||
    cuerpo === null ||
    typeof (cuerpo as Record<string, unknown>).csrfToken !== 'string'
  ) {
    throw new ErrorApi('La API no devolvió un token CSRF válido.', respuesta.status);
  }

  tokenCsrf = (cuerpo as { csrfToken: string }).csrfToken;
  return tokenCsrf;
}

interface OpcionesPeticion {
  method?: string;
  body?: unknown;
  autenticada?: boolean;
  headers?: Record<string, string>;
}

export async function peticionApi<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const metodo = opciones.method ?? 'GET';
  const modificaEstado = !['GET', 'HEAD', 'OPTIONS'].includes(metodo.toUpperCase());
  const cabeceras: Record<string, string> = {
    Accept: 'application/json',
    ...opciones.headers,
  };

  if (opciones.body !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }

  if (opciones.autenticada && tokenAcceso) {
    cabeceras.Authorization = `Bearer ${tokenAcceso}`;
  }

  if (modificaEstado) {
    if (!tokenCsrf) await obtenerTokenCsrf();
    cabeceras['X-CSRF-Token'] = tokenCsrf as string;
  }

  const respuesta = await fetch(ruta, {
    method: metodo,
    credentials: 'include',
    headers: cabeceras,
    ...(opciones.body === undefined
      ? {}
      : { body: JSON.stringify(opciones.body) }),
  });

  if (!respuesta.ok) {
    throw new ErrorApi(await leerMensajeError(respuesta), respuesta.status);
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}
