// Hash y verificacion de claves con Argon2id (parametros minimos recomendados por OWASP:
// 19 MiB de memoria, 2 iteraciones, 1 hilo). La sal es aleatoria y va dentro del propio hash.
import { argon2id, hash, verify } from 'argon2';

const OPCIONES = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

// Largo permitido de una clave; el maximo evita que se envien textos enormes para saturar el hash
export const LONGITUD_MINIMA_CLAVE = 12;
export const LONGITUD_MAXIMA_CLAVE = 128;

export async function hashearClave(clave: string): Promise<string> {
  return hash(clave, OPCIONES);
}

// Devuelve false (nunca lanza) si la clave no coincide o el hash guardado esta danado
export async function verificarClave(hashGuardado: string, clave: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, clave);
  } catch {
    return false;
  }
}

// Hash de relleno, calculado una sola vez, para igualar tiempos cuando el usuario no existe
let hashFalso: Promise<string> | undefined;

// Gasta el mismo tiempo que una verificacion real: evita descubrir que correos existen midiendo la respuesta
export async function gastarTiempoDeVerificacion(clave: string): Promise<void> {
  hashFalso ??= hashearClave('clave-de-relleno-para-igualar-tiempos');
  await verificarClave(await hashFalso, clave);
}