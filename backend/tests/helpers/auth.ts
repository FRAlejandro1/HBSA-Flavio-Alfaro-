// Dobles en memoria para probar autenticacion sin MySQL, Redis ni Argon2.
import { vi } from 'vitest';
import type {
  CredencialesUsuario,
  PerfilUsuario,
  SesionUsuario,
} from '../../src/modules/auth/auth.dominio';
import type { IAuthRepository } from '../../src/modules/auth/auth.repository';
import type { IClaves } from '../../src/modules/auth/auth.service';
import type { ISesionStore } from '../../src/shared/security/sesionStore';
import type { CodigoRol } from '../../src/shared/types/roles';

export interface UsuarioDePrueba {
  id: number;
  empresaId: number;
  rol: CodigoRol;
  correo: string;
  // Clave en texto plano de prueba; null representa un usuario sin cuenta para iniciar sesion
  clave: string | null;
  activo: boolean;
  tokenId: string | null;
}

// Repositorio sobre un Map; devuelve tambien el Map para poder comprobar el estado en las pruebas
export function crearRepositorioEnMemoria(iniciales: readonly UsuarioDePrueba[]): {
  repositorio: IAuthRepository;
  usuarios: Map<number, UsuarioDePrueba>;
} {
  const usuarios = new Map<number, UsuarioDePrueba>(iniciales.map((u) => [u.id, { ...u }]));

  const repositorio: IAuthRepository = {
    buscarCredencialesPorCorreo: (correo) => {
      const usuario = [...usuarios.values()].find((u) => u.correo === correo && u.activo);
      const credenciales: CredencialesUsuario | null = usuario
        ? {
            id: usuario.id,
            empresaId: usuario.empresaId,
            passwordHash: usuario.clave === null ? null : `hash:${usuario.clave}`,
            rol: usuario.rol,
          }
        : null;
      return Promise.resolve(credenciales);
    },

    buscarSesionPorId: (usuarioId) => {
      const usuario = usuarios.get(usuarioId);
      const sesion: SesionUsuario | null =
        usuario?.activo === true
          ? { id: usuario.id, empresaId: usuario.empresaId, rol: usuario.rol }
          : null;
      return Promise.resolve(sesion);
    },

    buscarPerfil: (empresaId, usuarioId) => {
      const usuario = usuarios.get(usuarioId);
      const perfil: PerfilUsuario | null =
        usuario?.activo === true && usuario.empresaId === empresaId
          ? {
              id: usuario.id,
              nombres: 'Ana',
              apellidos: 'Perez',
              correo: usuario.correo,
              rol: usuario.rol,
              empresa: { id: usuario.empresaId, nombre: 'Hospital de prueba' },
              area: { id: 1, detalle: 'Emergencia' },
              cargo: { id: 1, detalle: 'Medico' },
            }
          : null;
      return Promise.resolve(perfil);
    },

    guardarTokenId: (usuarioId, tokenId) => {
      const usuario = usuarios.get(usuarioId);
      if (usuario) {
        usuario.tokenId = tokenId;
      }
      return Promise.resolve();
    },

    rotarTokenId: (usuarioId, anterior, nuevo) => {
      const usuario = usuarios.get(usuarioId);
      if (usuario?.activo === true && usuario.tokenId === anterior) {
        usuario.tokenId = nuevo;
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },
  };

  return { repositorio, usuarios };
}

// Lista de revocados en memoria: guarda el jti y los segundos que se pidio mantenerlo
export function crearSesionesEnMemoria(): {
  sesiones: ISesionStore;
  revocados: Map<string, number>;
} {
  const revocados = new Map<string, number>();
  const sesiones: ISesionStore = {
    revocarToken: (jti, ttlSegundos) => {
      revocados.set(jti, ttlSegundos);
      return Promise.resolve();
    },
    estaRevocado: (jti) => Promise.resolve(revocados.has(jti)),
  };
  return { sesiones, revocados };
}

// Claves falsas: el "hash" de una clave es simplemente "hash:" + la clave
export function crearClavesFalsas(): {
  claves: IClaves;
  gastarTiempo: ReturnType<typeof vi.fn>;
} {
  const gastarTiempo = vi.fn((_clave: string) => Promise.resolve());
  const claves: IClaves = {
    verificar: (hashGuardado, clave) => Promise.resolve(hashGuardado === `hash:${clave}`),
    gastarTiempo,
  };
  return { claves, gastarTiempo };
}