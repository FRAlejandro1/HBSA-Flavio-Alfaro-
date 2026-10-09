// Reglas de negocio de la autenticacion: login, rotacion del refresh, cierre de sesion y perfil.
// Todas las dependencias entran por el constructor, asi el service se prueba sin base de datos ni Redis.
import { randomUUID } from 'node:crypto';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import { gastarTiempoDeVerificacion, verificarClave } from '../../shared/security/password';
import type { ISesionStore } from '../../shared/security/sesionStore';
import type { ITokens } from '../../shared/security/tokens';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import { MENSAJE_CREDENCIALES_INVALIDAS } from './auth.dominio';
import type { PerfilUsuario, ResultadoLogin, ResultadoRefresco } from './auth.dominio';
import type { IAuthRepository } from './auth.repository';

// Verificacion de claves detras de una interfaz, para sustituir Argon2 en las pruebas
export interface IClaves {
  verificar: (hashGuardado: string, clave: string) => Promise<boolean>;
  // Gasta el tiempo de una verificacion real cuando no hay hash que comparar
  gastarTiempo: (clave: string) => Promise<void>;
}

export const clavesArgon2: IClaves = {
  verificar: verificarClave,
  gastarTiempo: gastarTiempoDeVerificacion,
};

export interface DependenciasAuthService {
  repositorio: IAuthRepository;
  tokens: ITokens;
  claves: IClaves;
  sesiones: ISesionStore;
  // Segundos de vida del access token, para informarlo al frontend
  ttlAccesoSegundos: number;
  // Opcionales: se sustituyen en las pruebas para obtener resultados repetibles
  generarId?: () => string;
  ahora?: () => number;
}

export class AuthService {
  private readonly generarId: () => string;
  private readonly ahora: () => number;

  constructor(private readonly deps: DependenciasAuthService) {
    this.generarId = deps.generarId ?? randomUUID;
    this.ahora = deps.ahora ?? (() => Date.now());
  }

  async login(correo: string, clave: string): Promise<ResultadoLogin> {
    const credenciales = await this.deps.repositorio.buscarCredencialesPorCorreo(correo);
    const hashGuardado = credenciales?.passwordHash ?? null;

    // Sin usuario o sin cuenta: se gasta el mismo tiempo que una verificacion real
    if (!credenciales || !hashGuardado) {
      await this.deps.claves.gastarTiempo(clave);
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    if (!(await this.deps.claves.verificar(hashGuardado, clave))) {
      logger.warn('Inicio de sesion rechazado', { usuarioId: credenciales.id });
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    // Un nuevo login reemplaza el jti guardado: la sesion anterior deja de poder refrescarse
    const refreshId = this.generarId();
    await this.deps.repositorio.guardarTokenId(credenciales.id, refreshId);

    const [accessToken, refreshToken, usuario] = await Promise.all([
      this.deps.tokens.firmarAcceso({
        usuarioId: credenciales.id,
        empresaId: credenciales.empresaId,
        rol: credenciales.rol,
        jti: this.generarId(),
      }),
      this.deps.tokens.firmarRefresh({ usuarioId: credenciales.id, jti: refreshId }),
      this.deps.repositorio.buscarPerfil(credenciales.empresaId, credenciales.id),
    ]);

    if (!usuario) {
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    logger.info('Inicio de sesion', { usuarioId: credenciales.id, empresaId: credenciales.empresaId });
    return { accessToken, refreshToken, expiraEn: this.deps.ttlAccesoSegundos, usuario };
  }

  async refrescar(refreshToken: string): Promise<ResultadoRefresco> {
    // Lanza noAutenticado si la firma, el vencimiento o el tipo del token no son validos
    const datos = await this.deps.tokens.verificarRefresh(refreshToken);

    const sesion = await this.deps.repositorio.buscarSesionPorId(datos.usuarioId);
    if (!sesion) {
      throw AppError.noAutenticado();
    }

    // Rotacion: el refresh usado se reemplaza por uno nuevo en una sola operacion atomica
    const nuevoRefreshId = this.generarId();
    const rotado = await this.deps.repositorio.rotarTokenId(
      datos.usuarioId,
      datos.jti,
      nuevoRefreshId,
    );

    if (!rotado) {
      // Refresh ya usado o de una sesion cerrada: se cierra la sesion por seguridad
      await this.deps.repositorio.guardarTokenId(datos.usuarioId, null);
      logger.warn('Refresh token reutilizado o de una sesion cerrada', {
        usuarioId: datos.usuarioId,
      });
      throw AppError.noAutenticado();
    }

    const [accessToken, nuevoRefresh] = await Promise.all([
      this.deps.tokens.firmarAcceso({
        usuarioId: sesion.id,
        empresaId: sesion.empresaId,
        rol: sesion.rol,
        jti: this.generarId(),
      }),
      this.deps.tokens.firmarRefresh({ usuarioId: sesion.id, jti: nuevoRefreshId }),
    ]);

    return { accessToken, refreshToken: nuevoRefresh, expiraEn: this.deps.ttlAccesoSegundos };
  }

  async cerrarSesion(usuario: UsuarioAutenticado): Promise<void> {
    // El access token queda revocado en Redis solo mientras le queda vida
    const segundosRestantes = usuario.expira - Math.floor(this.ahora() / 1000);
    await this.deps.sesiones.revocarToken(usuario.jti, segundosRestantes);
    await this.deps.repositorio.guardarTokenId(usuario.id, null);
    logger.info('Cierre de sesion', { usuarioId: usuario.id, empresaId: usuario.empresaId });
  }

  async obtenerPerfil(usuario: UsuarioAutenticado): Promise<PerfilUsuario> {
    const perfil = await this.deps.repositorio.buscarPerfil(usuario.empresaId, usuario.id);
    if (!perfil) {
      throw AppError.noAutenticado();
    }
    return perfil;
  }
}