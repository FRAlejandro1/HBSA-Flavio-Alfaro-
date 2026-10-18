// Acceso a datos de areas, procesos y cargos. Solo SQL parametrizado y siempre filtrado por empresa_id
// (los procesos son un catalogo global y no llevan empresa_id).
// El service depende de IOrganizacionRepository, no de esta clase.
import type { IBaseDatos, ValorSql } from '../../config/database';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import type { MensajesErrorBD } from '../../shared/errors/errorBD';
import type {
  Area,
  CambiosArea,
  CambiosCargo,
  Cargo,
  DatosArea,
  DatosCargo,
  Proceso,
} from './organizacion.dominio';

export interface IOrganizacionRepository {
  // Catalogo de procesos institucionales, igual para todos los hospitales
  listarProcesos: () => Promise<Proceso[]>;

  listarAreas: (empresaId: number) => Promise<Area[]>;
  buscarArea: (empresaId: number, id: number) => Promise<Area | null>;
  // Devuelve el id de la nueva area
  crearArea: (empresaId: number, datos: DatosArea) => Promise<number>;
  actualizarArea: (empresaId: number, id: number, cambios: CambiosArea) => Promise<void>;
  // true si se elimino; false si no existia en ese hospital
  eliminarArea: (empresaId: number, id: number) => Promise<boolean>;

  listarCargos: (empresaId: number) => Promise<Cargo[]>;
  buscarCargo: (empresaId: number, id: number) => Promise<Cargo | null>;
  crearCargo: (empresaId: number, datos: DatosCargo) => Promise<number>;
  actualizarCargo: (empresaId: number, id: number, cambios: CambiosCargo) => Promise<void>;
  eliminarCargo: (empresaId: number, id: number) => Promise<boolean>;
}

interface FilaArea {
  id: number;
  detalle: string;
  parentId: number | null;
  procesoId: number | null;
  jefeId: number | null;
  jefeNombres: string | null;
  jefeApellidos: string | null;
}

const MENSAJES_AREA: MensajesErrorBD = {
  duplicado: 'Ya existe un area con ese nombre',
  enUso: 'El area tiene personal, subareas o solicitudes asignados y no se puede eliminar',
  referenciaInvalida: 'El jefe, el area padre o el proceso indicado no existe en este hospital',
};

const MENSAJES_CARGO: MensajesErrorBD = {
  duplicado: 'Ya existe un cargo con ese nombre',
  enUso: 'El cargo esta asignado a personal o a solicitudes y no se puede eliminar',
};

// Base de las consultas de areas: trae tambien el nombre del jefe, de la misma empresa
const SQL_AREAS = `
  SELECT a.id AS id, a.detalle AS detalle, a.parent_id AS parentId, a.proceso_id AS procesoId,
         u.id AS jefeId, u.nombres AS jefeNombres, u.apellidos AS jefeApellidos
  FROM areas a
  LEFT JOIN usuarios u ON u.empresa_id = a.empresa_id AND u.id = a.jefe_id
  WHERE a.empresa_id = ?`;

// Columnas de un cargo con los nombres que usa el dominio
const COLUMNAS_CARGO = `id, detalle, grado, rol_puesto AS rolPuesto, nivel_jerarquico AS nivelJerarquico,
         responsabilidad, funciones`;

function aArea(fila: FilaArea): Area {
  const jefe =
    fila.jefeId !== null && fila.jefeNombres !== null && fila.jefeApellidos !== null
      ? { id: fila.jefeId, nombres: fila.jefeNombres, apellidos: fila.jefeApellidos }
      : null;
  return {
    id: fila.id,
    detalle: fila.detalle,
    jefe,
    parentId: fila.parentId,
    procesoId: fila.procesoId,
  };
}

export class OrganizacionRepository implements IOrganizacionRepository {
  constructor(private readonly bd: IBaseDatos) {}

  listarProcesos(): Promise<Proceso[]> {
    return this.bd.consultar<Proceso>('SELECT id, codigo, detalle FROM procesos ORDER BY id', []);
  }

  async listarAreas(empresaId: number): Promise<Area[]> {
    const filas = await this.bd.consultar<FilaArea>(`${SQL_AREAS} ORDER BY a.detalle`, [empresaId]);
    return filas.map(aArea);
  }

  async buscarArea(empresaId: number, id: number): Promise<Area | null> {
    const [fila] = await this.bd.consultar<FilaArea>(`${SQL_AREAS} AND a.id = ? LIMIT 1`, [
      empresaId,
      id,
    ]);
    return fila ? aArea(fila) : null;
  }

  async crearArea(empresaId: number, datos: DatosArea): Promise<number> {
    try {
      const resultado = await this.bd.ejecutar(
        'INSERT INTO areas (empresa_id, proceso_id, parent_id, detalle, jefe_id) VALUES (?, ?, ?, ?, ?)',
        [empresaId, datos.procesoId, datos.parentId, datos.detalle, datos.jefeId],
      );
      return resultado.idInsertado;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_AREA);
    }
  }

  async actualizarArea(empresaId: number, id: number, cambios: CambiosArea): Promise<void> {
    // Las columnas son fijas: nunca se arma SQL con nombres que vengan del cliente
    const asignaciones: string[] = [];
    const valores: ValorSql[] = [];
    if (cambios.detalle !== undefined) {
      asignaciones.push('detalle = ?');
      valores.push(cambios.detalle);
    }
    if (cambios.jefeId !== undefined) {
      asignaciones.push('jefe_id = ?');
      valores.push(cambios.jefeId);
    }
    if (cambios.parentId !== undefined) {
      asignaciones.push('parent_id = ?');
      valores.push(cambios.parentId);
    }
    if (asignaciones.length === 0) {
      return;
    }
    try {
      await this.bd.ejecutar(
        `UPDATE areas SET ${asignaciones.join(', ')} WHERE empresa_id = ? AND id = ?`,
        [...valores, empresaId, id],
      );
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_AREA);
    }
  }

  async eliminarArea(empresaId: number, id: number): Promise<boolean> {
    try {
      const resultado = await this.bd.ejecutar('DELETE FROM areas WHERE empresa_id = ? AND id = ?', [
        empresaId,
        id,
      ]);
      return resultado.filasAfectadas === 1;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_AREA);
    }
  }

  listarCargos(empresaId: number): Promise<Cargo[]> {
    return this.bd.consultar<Cargo>(
      `SELECT ${COLUMNAS_CARGO}
       FROM cargos WHERE empresa_id = ? ORDER BY detalle`,
      [empresaId],
    );
  }

  async buscarCargo(empresaId: number, id: number): Promise<Cargo | null> {
    const [cargo] = await this.bd.consultar<Cargo>(
      `SELECT ${COLUMNAS_CARGO}
       FROM cargos WHERE empresa_id = ? AND id = ? LIMIT 1`,
      [empresaId, id],
    );
    return cargo ?? null;
  }

  async crearCargo(empresaId: number, datos: DatosCargo): Promise<number> {
    try {
      const resultado = await this.bd.ejecutar(
        `INSERT INTO cargos (empresa_id, detalle, grado, rol_puesto, nivel_jerarquico, responsabilidad, funciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          datos.detalle,
          datos.grado,
          datos.rolPuesto,
          datos.nivelJerarquico,
          datos.responsabilidad,
          datos.funciones,
        ],
      );
      return resultado.idInsertado;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_CARGO);
    }
  }

  async actualizarCargo(empresaId: number, id: number, cambios: CambiosCargo): Promise<void> {
    const asignaciones: string[] = [];
    const valores: ValorSql[] = [];
    if (cambios.detalle !== undefined) {
      asignaciones.push('detalle = ?');
      valores.push(cambios.detalle);
    }
    if (cambios.grado !== undefined) {
      asignaciones.push('grado = ?');
      valores.push(cambios.grado);
    }
    if (cambios.rolPuesto !== undefined) {
      asignaciones.push('rol_puesto = ?');
      valores.push(cambios.rolPuesto);
    }
    if (cambios.nivelJerarquico !== undefined) {
      asignaciones.push('nivel_jerarquico = ?');
      valores.push(cambios.nivelJerarquico);
    }
    if (cambios.responsabilidad !== undefined) {
      asignaciones.push('responsabilidad = ?');
      valores.push(cambios.responsabilidad);
    }
    if (cambios.funciones !== undefined) {
      asignaciones.push('funciones = ?');
      valores.push(cambios.funciones);
    }
    if (asignaciones.length === 0) {
      return;
    }
    try {
      await this.bd.ejecutar(
        `UPDATE cargos SET ${asignaciones.join(', ')} WHERE empresa_id = ? AND id = ?`,
        [...valores, empresaId, id],
      );
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_CARGO);
    }
  }

  async eliminarCargo(empresaId: number, id: number): Promise<boolean> {
    try {
      const resultado = await this.bd.ejecutar('DELETE FROM cargos WHERE empresa_id = ? AND id = ?', [
        empresaId,
        id,
      ]);
      return resultado.filasAfectadas === 1;
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES_CARGO);
    }
  }
}