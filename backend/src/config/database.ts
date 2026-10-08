// Unico punto de acceso a la base de datos.
// El resto del sistema (repositories) depende de IBaseDatos, nunca de mysql2:
// para cambiar de motor solo se implementa esta interfaz y se ajusta la fabrica.
import { createPool } from 'mysql2/promise';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from './env';
import { logger } from './logger';

// Valores que pueden viajar como parametros de una consulta
export type ValorSql = string | number | boolean | Date | Buffer | null;

// Resultado de una sentencia que modifica datos
export interface ResultadoEjecucion {
  filasAfectadas: number;
  idInsertado: number;
}

// Operaciones disponibles dentro y fuera de una transaccion
export interface IConexionBD {
  consultar<T extends object>(sql: string, valores?: readonly ValorSql[]): Promise<T[]>;
  ejecutar(sql: string, valores?: readonly ValorSql[]): Promise<ResultadoEjecucion>;
}

// Contrato completo que consumen los repositories y los services
export interface IBaseDatos extends IConexionBD {
  transaccion<T>(trabajo: (conexion: IConexionBD) => Promise<T>): Promise<T>;
  verificar(): Promise<void>;
  cerrar(): Promise<void>;
}

// Funcion que ejecuta una sentencia parametrizada sobre un pool o una conexion
type EjecutorSql = (
  sql: string,
  valores: readonly ValorSql[],
) => Promise<[RowDataPacket[] | ResultSetHeader, unknown]>;

// Implementacion de las operaciones sobre un ejecutor (siempre con parametros, nunca concatenando)
class ConexionMySql implements IConexionBD {
  constructor(private readonly ejecutarSql: EjecutorSql) {}

  async consultar<T extends object>(sql: string, valores: readonly ValorSql[] = []): Promise<T[]> {
    const [filas] = await this.ejecutarSql(sql, valores);
    return filas as unknown as T[];
  }

  async ejecutar(sql: string, valores: readonly ValorSql[] = []): Promise<ResultadoEjecucion> {
    const [resultado] = await this.ejecutarSql(sql, valores);
    const cabecera = resultado as ResultSetHeader;
    return { filasAfectadas: cabecera.affectedRows, idInsertado: cabecera.insertId };
  }
}

// Implementacion MySQL con pool de conexiones
class BaseDatosMySql extends ConexionMySql implements IBaseDatos {
  constructor(private readonly pool: Pool) {
    super((sql, valores) => pool.execute<RowDataPacket[] | ResultSetHeader>(sql, [...valores]));
  }

  // Ejecuta el trabajo dentro de una transaccion: confirma si termina bien, revierte si falla
  async transaccion<T>(trabajo: (conexion: IConexionBD) => Promise<T>): Promise<T> {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await trabajo(
        new ConexionMySql((sql, valores) =>
          conexion.execute<RowDataPacket[] | ResultSetHeader>(sql, [...valores]),
        ),
      );
      await conexion.commit();
      return resultado;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  // Comprobacion de salud: falla si la base no responde
  async verificar(): Promise<void> {
    await this.consultar('SELECT 1 AS ok');
  }

  // Cierra el pool al apagar el servidor
  async cerrar(): Promise<void> {
    await this.pool.end();
  }
}

// Fabrica del pool a partir de la configuracion validada
function crearBaseDatos(): IBaseDatos {
  const pool = createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_POOL_LIMIT,
    waitForConnections: true,
    // Hora de Ecuador continental; las fechas se devuelven como texto para evitar desfases
    timezone: '-05:00',
    dateStrings: true,
  });
  logger.info('Pool de MySQL creado', { host: env.DB_HOST, base: env.DB_NAME });
  return new BaseDatosMySql(pool);
}

// Instancia unica, creada la primera vez que se pide (no al importar el archivo)
let instancia: IBaseDatos | undefined;

export function obtenerBaseDatos(): IBaseDatos {
  instancia ??= crearBaseDatos();
  return instancia;
}

export async function cerrarBaseDatos(): Promise<void> {
  if (instancia) {
    await instancia.cerrar();
    instancia = undefined;
  }
}