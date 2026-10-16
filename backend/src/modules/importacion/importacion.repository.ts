// Acceso a datos de la importacion de personal: catalogos y personas del hospital, y aplicacion del plan
// en una sola transaccion (si algo falla, no se guarda nada). Solo SQL parametrizado y siempre por empresa_id.
import type { IBaseDatos, ValorSql } from '../../config/database';
import { traducirErrorBD } from '../../shared/errors/errorBD';
import { aCodigoRol } from '../../shared/types/roles';
import type { EstadoUsuario } from '../usuarios/usuarios.dominio';
import type { ItemCatalogo, PlanAplicacion, UsuarioExistente } from './importacion.dominio';

export interface IImportacionRepository {
  listarAreas: (empresaId: number) => Promise<ItemCatalogo[]>;
  listarCargos: (empresaId: number) => Promise<ItemCatalogo[]>;
  listarUsuarios: (empresaId: number) => Promise<UsuarioExistente[]>;
  aplicar: (empresaId: number, plan: PlanAplicacion) => Promise<void>;
}

interface FilaUsuario {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  areaId: number;
  cargoId: number;
  rol: string;
  jefeCedula: string | null;
  fechaIngreso: string;
  estado: EstadoUsuario;
  fechaBaja: string | null;
}

const MENSAJES = {
  duplicado: 'Una cédula o un correo del archivo ya existe en el sistema',
  referenciaInvalida: 'Un área, cargo o jefe del archivo no existe en este hospital',
};

export class ImportacionRepository implements IImportacionRepository {
  constructor(private readonly bd: IBaseDatos) {}

  listarAreas(empresaId: number): Promise<ItemCatalogo[]> {
    return this.bd.consultar<ItemCatalogo>('SELECT id, detalle FROM areas WHERE empresa_id = ?', [empresaId]);
  }

  listarCargos(empresaId: number): Promise<ItemCatalogo[]> {
    return this.bd.consultar<ItemCatalogo>('SELECT id, detalle FROM cargos WHERE empresa_id = ?', [empresaId]);
  }

  async listarUsuarios(empresaId: number): Promise<UsuarioExistente[]> {
    const filas = await this.bd.consultar<FilaUsuario>(
      `SELECT u.id AS id, u.cedula AS cedula, u.nombres AS nombres, u.apellidos AS apellidos,
              u.email AS correo, u.telefono AS telefono, u.area_id AS areaId, u.cargo_id AS cargoId,
              r.codigo AS rol, j.cedula AS jefeCedula, u.fecha_ingreso AS fechaIngreso,
              u.estado AS estado, u.fecha_baja AS fechaBaja
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       LEFT JOIN usuarios j ON j.empresa_id = u.empresa_id AND j.id = u.jefe_inmediato_id
       WHERE u.empresa_id = ?`,
      [empresaId],
    );
    return filas.map((fila) => ({ ...fila, rol: aCodigoRol(fila.rol) }));
  }

  async aplicar(empresaId: number, plan: PlanAplicacion): Promise<void> {
    try {
      await this.bd.transaccion(async (tx) => {
        // 1. Personas nuevas, sin jefe todavia (el jefe puede ser otra persona nueva)
        for (const p of plan.crear) {
          await tx.ejecutar(
            `INSERT INTO usuarios
               (empresa_id, area_id, cargo_id, rol_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
             VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, ?, ?, ?, ?, ?)`,
            [empresaId, p.areaId, p.cargoId, p.rol, p.cedula, p.nombres, p.apellidos, p.correo, p.telefono, p.fechaIngreso],
          );
        }

        // 2. Personas existentes: solo las columnas que cambian (nombres de columna fijos, nunca del cliente)
        for (const a of plan.actualizar) {
          const asignaciones: string[] = [];
          const valores: ValorSql[] = [];
          const agregar = (columna: string, valor: ValorSql | undefined): void => {
            if (valor !== undefined) {
              asignaciones.push(`${columna} = ?`);
              valores.push(valor);
            }
          };
          agregar('nombres', a.cambios.nombres);
          agregar('apellidos', a.cambios.apellidos);
          agregar('email', a.cambios.correo);
          agregar('telefono', a.cambios.telefono);
          agregar('area_id', a.cambios.areaId);
          agregar('cargo_id', a.cambios.cargoId);
          agregar('fecha_ingreso', a.cambios.fechaIngreso);
          if (a.cambios.rol !== undefined) {
            asignaciones.push('rol_id = (SELECT id FROM roles WHERE codigo = ?)');
            valores.push(a.cambios.rol);
          }
          if (a.cerrarSesion) {
            asignaciones.push('token_id = NULL');
          }
          if (asignaciones.length > 0) {
            await tx.ejecutar(`UPDATE usuarios SET ${asignaciones.join(', ')} WHERE empresa_id = ? AND id = ?`, [
              ...valores,
              empresaId,
              a.id,
            ]);
          }
        }

        // 3. Jefes inmediatos, ya con todas las personas creadas; la base resuelve cedula -> id
        for (const j of plan.jefes) {
          await tx.ejecutar(
            `UPDATE usuarios u
             INNER JOIN usuarios jefe ON jefe.empresa_id = u.empresa_id AND jefe.cedula = ?
             SET u.jefe_inmediato_id = jefe.id
             WHERE u.empresa_id = ? AND u.cedula = ?`,
            [j.cedulaJefe, empresaId, j.cedula],
          );
        }

        // 4. Bajas: inactivas, con fecha y sin poder renovar la sesion
        for (const b of plan.bajas) {
          await tx.ejecutar(
            `UPDATE usuarios SET estado = 'INACTIVO', fecha_baja = ?, token_id = NULL
             WHERE empresa_id = ? AND id = ?`,
            [b.fechaBaja, empresaId, b.id],
          );
        }
      });
    } catch (error) {
      throw traducirErrorBD(error, MENSAJES);
    }
  }
}