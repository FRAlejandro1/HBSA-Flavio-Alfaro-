// Acceso a datos de autenticacion. Solo SQL parametrizado, sin reglas de negocio.
// El service depende de IAuthRepository, no de esta clase.
import type { IBaseDatos } from '../../config/database';
import { esCodigoRol } from '../../shared/types/roles';
import type { CodigoRol } from '../../shared/types/roles';
import type { CredencialesUsuario, PerfilUsuario, SesionUsuario } from './auth.dominio';

export interface IAuthRepository {
  // Busca por correo a un usuario ACTIVO de un hospital ACTIVO
  buscarCredencialesPorCorreo: (correo: string) => Promise<CredencialesUsuario | null>;
  buscarSesionPorId: (usuarioId: number) => Promise<SesionUsuario | null>;
  buscarPerfil: (empresaId: number, usuarioId: number) => Promise<PerfilUsuario | null>;
  // Guarda (o borra con null) el jti del refresh token vigente
  guardarTokenId: (usuarioId: number, tokenId: string | null) => Promise<void>;
  // Cambia el jti solo si sigue siendo el anterior: operacion atomica contra la reutilizacion de tokens
  rotarTokenId: (usuarioId: number, anterior: string, nuevo: string) => Promise<boolean>;
}

interface FilaCredenciales {
  id: number;
  empresaId: number;
  passwordHash: string | null;
  rol: string;
}

interface FilaPerfil {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string | null;
  rol: string;
  empresaId: number;
  empresaNombre: string;
  areaId: number;
  areaDetalle: string;
  cargoId: number;
  cargoDetalle: string;
}

// Un valor desconocido en roles indica datos danados: se falla en vez de adivinar un rol
function aRol(valor: string): CodigoRol {
  if (!esCodigoRol(valor)) {
    throw new Error(`Rol desconocido en la base de datos: ${valor}`);
  }
  return valor;
}

// Base de las consultas de sesion: usuario activo en un hospital activo
const SQL_SESION = `
  SELECT u.id AS id, u.empresa_id AS empresaId, u.password_hash AS passwordHash, r.codigo AS rol
  FROM usuarios u
  INNER JOIN roles r ON r.id = u.rol_id
  INNER JOIN empresas e ON e.id = u.empresa_id
  WHERE u.estado = 'ACTIVO' AND e.estado = 'ACTIVA'`;

export class AuthRepository implements IAuthRepository {
  constructor(private readonly bd: IBaseDatos) {}

  async buscarCredencialesPorCorreo(correo: string): Promise<CredencialesUsuario | null> {
    const [fila] = await this.bd.consultar<FilaCredenciales>(`${SQL_SESION} AND u.email = ? LIMIT 1`, [
      correo,
    ]);
    if (!fila) {
      return null;
    }
    return {
      id: fila.id,
      empresaId: fila.empresaId,
      passwordHash: fila.passwordHash,
      rol: aRol(fila.rol),
    };
  }

  async buscarSesionPorId(usuarioId: number): Promise<SesionUsuario | null> {
    const [fila] = await this.bd.consultar<FilaCredenciales>(`${SQL_SESION} AND u.id = ? LIMIT 1`, [
      usuarioId,
    ]);
    if (!fila) {
      return null;
    }
    return { id: fila.id, empresaId: fila.empresaId, rol: aRol(fila.rol) };
  }

  async buscarPerfil(empresaId: number, usuarioId: number): Promise<PerfilUsuario | null> {
    // Siempre filtrado por empresa_id: un usuario nunca se resuelve fuera de su hospital
    const [fila] = await this.bd.consultar<FilaPerfil>(
      `SELECT u.id AS id, u.nombres AS nombres, u.apellidos AS apellidos, u.email AS correo,
              r.codigo AS rol, e.id AS empresaId, e.nombre AS empresaNombre,
              a.id AS areaId, a.detalle AS areaDetalle, c.id AS cargoId, c.detalle AS cargoDetalle
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       INNER JOIN empresas e ON e.id = u.empresa_id
       INNER JOIN areas a ON a.empresa_id = u.empresa_id AND a.id = u.area_id
       INNER JOIN cargos c ON c.empresa_id = u.empresa_id AND c.id = u.cargo_id
       WHERE u.empresa_id = ? AND u.id = ? AND u.estado = 'ACTIVO'
       LIMIT 1`,
      [empresaId, usuarioId],
    );
    if (!fila) {
      return null;
    }
    return {
      id: fila.id,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      correo: fila.correo,
      rol: aRol(fila.rol),
      empresa: { id: fila.empresaId, nombre: fila.empresaNombre },
      area: { id: fila.areaId, detalle: fila.areaDetalle },
      cargo: { id: fila.cargoId, detalle: fila.cargoDetalle },
    };
  }

  async guardarTokenId(usuarioId: number, tokenId: string | null): Promise<void> {
    await this.bd.ejecutar('UPDATE usuarios SET token_id = ? WHERE id = ?', [tokenId, usuarioId]);
  }

  async rotarTokenId(usuarioId: number, anterior: string, nuevo: string): Promise<boolean> {
    // La condicion token_id = anterior hace que solo un refresh concurrente gane la rotacion
    const resultado = await this.bd.ejecutar(
      "UPDATE usuarios SET token_id = ? WHERE id = ? AND token_id = ? AND estado = 'ACTIVO'",
      [nuevo, usuarioId, anterior],
    );
    return resultado.filasAfectadas === 1;
  }
}