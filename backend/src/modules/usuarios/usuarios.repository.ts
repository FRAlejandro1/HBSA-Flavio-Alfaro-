// Acceso a datos de usuarios. Solo SQL parametrizado y siempre filtrado por empresa_id.
// El service depende de IUsuariosRepository, no de esta clase.
import type { IBaseDatos, ValorSql } from '../../config/database';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import { aCodigoRol } from '../../shared/types/roles';
import type {
  CambiosUsuario,
  DatosNuevoUsuario,
  EstadoUsuario,
  FiltrosUsuarios,
  UsuarioDetalle,
} from './usuarios.dominio';

export interface IUsuariosRepository {
  buscar: (
    empresaId: number,
    filtros: FiltrosUsuarios,
  ) => Promise<{ usuarios: UsuarioDetalle[]; total: number }>;
  obtener: (empresaId: number, id: number) => Promise<UsuarioDetalle | null>;
  // Devuelve el id de la nueva persona
  crear: (empresaId: number, datos: DatosNuevoUsuario) => Promise<number>;
  actualizar: (empresaId: number, id: number, cambios: CambiosUsuario) => Promise<void>;
  // Con fechaBaja en null se usa la fecha de hoy
  darDeBaja: (empresaId: number, id: number, fechaBaja: string | null) => Promise<void>;
  reactivar: (empresaId: number, id: number) => Promise<void>;
}

interface FilaUsuario {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  rol: string;
  areaId: number;
  areaDetalle: string;
  cargoId: number;
  cargoDetalle: string;
  jefeId: number | null;
  jefeNombres: string | null;
  jefeApellidos: string | null;
  fechaIngreso: string;
  estado: EstadoUsuario;
  fechaBaja: string | null;
  tieneCuenta: number;
}

const MENSAJES: MensajesErrorBD = {
  duplicado: 'Ya existe una persona con esa cedula o ese correo',
  enUso: 'La persona tiene registros asociados y no se puede eliminar',
  referenciaInvalida: 'El area, el cargo o el jefe inmediato indicado no existe en este hospital',
};

// Base de las consultas: la persona con su rol, area, cargo y jefe inmediato, siempre de la misma empresa
const SQL_USUARIOS = `
  SELECT u.id AS id, u.cedula AS cedula, u.nombres AS nombres, u.apellidos AS apellidos,
         u.email AS correo, u.telefono AS telefono, r.codigo AS rol,
         a.id AS areaId, a.detalle AS areaDetalle, c.id AS cargoId, c.detalle AS cargoDetalle,
         j.id AS jefeId, j.nombres AS jefeNombres, j.apellidos AS jefeApellidos,
         u.fecha_ingreso AS fechaIngreso, u.estado AS estado, u.fecha_baja AS fechaBaja,
         (u.password_hash IS NOT NULL) AS tieneCuenta
  FROM usuarios u
  INNER JOIN roles r ON r.id = u.rol_id
  INNER JOIN areas a ON a.empresa_id = u.empresa_id AND a.id = u.area_id
  INNER JOIN cargos c ON c.empresa_id = u.empresa_id AND c.id = u.cargo_id
  LEFT JOIN usuarios j ON j.empresa_id = u.empresa_id AND j.id = u.jefe_inmediato_id
  WHERE u.empresa_id = ?`;

function aUsuario(fila: FilaUsuario): UsuarioDetalle {
  const jefeInmediato =
    fila.jefeId !== null && fila.jefeNombres !== null && fila.jefeApellidos !== null
      ? { id: fila.jefeId, nombres: fila.jefeNombres, apellidos: fila.jefeApellidos }
      : null;
  return {
    id: fila.id,
    cedula: fila.cedula,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    correo: fila.correo,
    telefono: fila.telefono,
    rol: aCodigoRol(fila.rol),
    area: { id: fila.areaId, detalle: fila.areaDetalle },
    cargo: { id: fila.cargoId, detalle: fila.cargoDetalle },
    jefeInmediato,
    fechaIngreso: fila.fechaIngreso,
    estado: fila.estado,
    fechaBaja: fila.fechaBaja,
    tieneCuenta: Number(fila.tieneCuenta) === 1,
  };
}

// Los caracteres comodin de LIKE se escapan: el texto buscado se toma literalmente
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

// Condiciones de busqueda; cada palabra debe coincidir con el inicio de cedula, apellido, nombre o correo,
// asi se aprovechan los indices (ix_usuarios_busqueda y los unicos)
function construirFiltros(filtros: FiltrosUsuarios): { donde: string; valores: ValorSql[] } {
  const condiciones: string[] = [];
  const valores: ValorSql[] = [];

  const terminos = (filtros.busqueda ?? '')
    .split(/\s+/)
    .filter((termino) => termino.length > 0)
    .slice(0, 5);
  for (const termino of terminos) {
    condiciones.push('(u.cedula LIKE ? OR u.apellidos LIKE ? OR u.nombres LIKE ? OR u.email LIKE ?)');
    const patron = `${escaparLike(termino)}%`;
    valores.push(patron, patron, patron, patron);
  }
  if (filtros.areaId !== undefined) {
    condiciones.push('u.area_id = ?');
    valores.push(filtros.areaId);
  }
  if (filtros.estado !== undefined) {
    condiciones.push('u.estado = ?');
    valores.push(filtros.estado);
  }

  return { donde: condiciones.map((condicion) => ` AND ${condicion}`).join(''), valores };
}

export class UsuariosRepository implements IUsuariosRepository {
  constructor(private readonly bd: IBaseDatos) {}

  async buscar(
    empresaId: number,
    filtros: FiltrosUsuarios,
  ): Promise<{ usuarios: UsuarioDetalle[]; total: number }> {
    const { donde, valores } = construirFiltros(filtros);
    // Enteros ya validados por Zod: se escriben en la consulta porque LIMIT no admite parametros de forma fiable
    const limite = Math.trunc(filtros.porPagina);
    const desplazamiento = (Math.trunc(filtros.pagina) - 1) * limite;

    const [filas, conteo] = await Promise.all([
      this.bd.consultar<FilaUsuario>(
        `${SQL_USUARIOS}${donde} ORDER BY u.apellidos, u.nombres, u.id LIMIT ${limite} OFFSET ${desplazamiento}`,
        [empresaId, ...valores],
      ),
      this.bd.consultar<{ total: number }>(
        `SELECT COUNT(*) AS total FROM usuarios u WHERE u.empresa_id = ?${donde}`,
        [empresaId, ...valores],
      ),
    ]);

    return {
      usuarios: filas.map(aUsuario),
      total: Number.parseFloat(String(conteo[0]?.total ?? 0)),
    };
  }

  async obtener(empresaId: number, id: number): Promise<UsuarioDetalle | null> {
    const [fila] = await this.bd.consultar<FilaUsuario>(`${SQL_USUARIOS} AND u.id = ? LIMIT 1`, [
      empresaId,
      id,
    ]);
    return fila ? aUsuario(fila) : null;
  }

  async crear(empresaId: number, datos: DatosNuevoUsuario): Promise<number> {
    try {
      const resultado = await this.bd.ejecutar(
        `INSERT INTO usuarios
           (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos,
            email, telefono, password_hash, fecha_ingreso)
         VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          datos.areaId,
          datos.cargoId,
          datos.rol,
          datos.jefeInmediatoId,
          datos.cedula,
          datos.nombres,
          datos.apellidos,
          datos.correo,
          datos.telefono,
          datos.passwordHash,
          datos.fechaIngreso,
        ],
      );
      return resultado.idInsertado;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async actualizar(empresaId: number, id: number, cambios: CambiosUsuario): Promise<void> {
    // Las columnas son fijas: nunca se arma SQL con nombres que vengan del cliente
    const asignaciones: string[] = [];
    const valores: ValorSql[] = [];
    const agregar = (columna: string, valor: ValorSql | undefined): void => {
      if (valor !== undefined) {
        asignaciones.push(`${columna} = ?`);
        valores.push(valor);
      }
    };

    agregar('cedula', cambios.cedula);
    agregar('nombres', cambios.nombres);
    agregar('apellidos', cambios.apellidos);
    agregar('email', cambios.correo);
    agregar('telefono', cambios.telefono);
    agregar('area_id', cambios.areaId);
    agregar('cargo_id', cambios.cargoId);
    agregar('jefe_inmediato_id', cambios.jefeInmediatoId);
    agregar('fecha_ingreso', cambios.fechaIngreso);
    agregar('password_hash', cambios.passwordHash);
    if (cambios.rol !== undefined) {
      asignaciones.push('rol_id = (SELECT id FROM roles WHERE codigo = ?)');
      valores.push(cambios.rol);
    }
    if (cambios.cerrarSesion === true) {
      asignaciones.push('token_id = NULL');
    }
    if (asignaciones.length === 0) {
      return;
    }

    try {
      await this.bd.ejecutar(
        `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE empresa_id = ? AND id = ?`,
        [...valores, empresaId, id],
      );
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }

  async darDeBaja(empresaId: number, id: number, fechaBaja: string | null): Promise<void> {
    // Inactivo, con fecha de baja, y sin refresh token: ya no puede renovar su sesion
    await this.bd.ejecutar(
      `UPDATE usuarios SET estado = 'INACTIVO', fecha_baja = COALESCE(?, CURDATE()), token_id = NULL
       WHERE empresa_id = ? AND id = ?`,
      [fechaBaja, empresaId, id],
    );
  }

  async reactivar(empresaId: number, id: number): Promise<void> {
    await this.bd.ejecutar(
      "UPDATE usuarios SET estado = 'ACTIVO', fecha_baja = NULL WHERE empresa_id = ? AND id = ?",
      [empresaId, id],
    );
  }
}