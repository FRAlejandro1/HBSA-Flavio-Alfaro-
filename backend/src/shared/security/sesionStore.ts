// Lista de tokens revocados en Redis. Cada jti revocado vive solo hasta que el token
// habria expirado de todas formas, asi la lista no crece sin limite.
// Si Redis no responde, la peticion falla: es preferible a dejar pasar un token que podria estar revocado.
import { obtenerRedis } from '../../config/redis';

export interface ISesionStore {
  // Marca un jti como revocado durante ttlSegundos
  revocarToken: (jti: string, ttlSegundos: number) => Promise<void>;
  estaRevocado: (jti: string) => Promise<boolean>;
}

const PREFIJO = 'revocado:jti:';

// Implementacion real sobre Redis (la conexion se abre al usarla, no al importar)
export const sesionStoreRedis: ISesionStore = {
  async revocarToken(jti, ttlSegundos) {
    if (ttlSegundos <= 0) {
      return;
    }
    await obtenerRedis().set(`${PREFIJO}${jti}`, '1', 'EX', Math.ceil(ttlSegundos));
  },

  async estaRevocado(jti) {
    return (await obtenerRedis().exists(`${PREFIJO}${jti}`)) === 1;
  },
};