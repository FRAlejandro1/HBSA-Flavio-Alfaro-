// Aplica migraciones y seeds SQL sobre cualquier MySQL (desarrollo, pruebas o produccion), sin depender de Docker.
// Lo usan el comando "migrar" y la preparacion de las pruebas con base de datos real.
// Las migraciones se registran en schema_migraciones y nunca se repiten; los seeds son idempotentes.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';

export interface ConexionMigrador {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export type ModoMigracion = 'todo' | 'migraciones' | 'seeds';

export interface OpcionesMigracion {
  conexion: ConexionMigrador;
  // Carpeta "database" del repositorio, con migrations/ y seeds/
  directorioSql: string;
  modo: ModoMigracion;
  // Carga tambien los seeds de demostracion (archivos con "_demo" en el nombre); nunca en produccion
  incluirDemo: boolean;
  // Borra todas las tablas antes de migrar; solo se permite en bases cuyo nombre termina en _test
  reiniciar?: boolean;
}

export interface ResultadoMigracion {
  migraciones: string[];
  seeds: string[];
}

// Quita el comentario "-- ..." del final de una linea, sin tocar los "--" que esten dentro de un texto entre comillas
function quitarComentarioFinal(linea: string): string {
  let comilla: string | null = null;
  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i];
    if (comilla !== null) {
      if (caracter === '\\') {
        i++;
      } else if (caracter === comilla) {
        comilla = null;
      }
      continue;
    }
    if (caracter === "'" || caracter === '"' || caracter === '`') {
      comilla = caracter;
      continue;
    }
    const siguiente = linea[i + 1];
    const despues = linea[i + 2];
    if (
      caracter === '-' &&
      siguiente === '-' &&
      (despues === undefined || despues === ' ' || despues === '\t')
    ) {
      return linea.slice(0, i).trimEnd();
    }
  }
  return linea;
}

// Separa un archivo SQL en sentencias respetando DELIMITER, que es una instruccion del cliente mysql
// y no del servidor (los triggers la usan para poder escribir ";" dentro de su cuerpo)
export function dividirSentencias(contenido: string): string[] {
  const sentencias: string[] = [];
  let delimitador = ';';
  let acumulado = '';

  for (const lineaCruda of contenido.split(/\r?\n/)) {
    const cambioDelimitador = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(lineaCruda);
    if (cambioDelimitador?.[1] !== undefined) {
      delimitador = cambioDelimitador[1];
      continue;
    }

    const linea = quitarComentarioFinal(lineaCruda);
    if (linea.trim() === '') {
      continue;
    }

    acumulado += `${linea}\n`;
    const recortado = acumulado.trimEnd();
    if (recortado.endsWith(delimitador)) {
      sentencias.push(recortado.slice(0, -delimitador.length).trim());
      acumulado = '';
    }
  }

  // Una ultima sentencia sin delimitador final tambien se conserva
  if (acumulado.trim() !== '') {
    sentencias.push(acumulado.trim());
  }
  return sentencias.filter((sentencia) => sentencia.length > 0);
}

async function listarSql(directorio: string): Promise<string[]> {
  const nombres = await readdir(directorio);
  return nombres.filter((nombre) => nombre.endsWith('.sql')).sort();
}

async function ejecutarArchivo(conexion: Connection, ruta: string): Promise<void> {
  const contenido = await readFile(ruta, 'utf8');
  for (const sentencia of dividirSentencias(contenido)) {
    await conexion.query(sentencia);
  }
}

// Una sola migracion a la vez: evita que dos despliegues simultaneos apliquen lo mismo
async function obtenerBloqueo(conexion: Connection): Promise<void> {
  const [filas] = await conexion.query<(RowDataPacket & { bloqueo: number | null })[]>(
    "SELECT GET_LOCK('hbsa_migraciones', 30) AS bloqueo",
  );
  if (filas[0]?.bloqueo !== 1) {
    throw new Error('No se pudo obtener el bloqueo de migraciones: hay otra migracion en curso');
  }
}

// Borra todas las tablas (y con ellas sus triggers) de la base conectada
async function reiniciarEsquema(conexion: Connection): Promise<void> {
  const [tablas] = await conexion.query<(RowDataPacket & { nombre: string })[]>(
    "SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
  );
  await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of tablas) {
    await conexion.query(`DROP TABLE IF EXISTS \`${tabla.nombre}\``);
  }
  await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function aplicarMigraciones(conexion: Connection, directorioSql: string): Promise<string[]> {
  await conexion.query(
    'CREATE TABLE IF NOT EXISTS schema_migraciones (archivo VARCHAR(150) NOT NULL PRIMARY KEY, aplicada_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const [registradas] = await conexion.query<(RowDataPacket & { archivo: string })[]>(
    'SELECT archivo FROM schema_migraciones',
  );
  const yaAplicadas = new Set(registradas.map((fila) => fila.archivo));

  const aplicadas: string[] = [];
  const directorio = path.join(directorioSql, 'migrations');
  for (const nombre of await listarSql(directorio)) {
    if (yaAplicadas.has(nombre)) {
      continue;
    }
    await ejecutarArchivo(conexion, path.join(directorio, nombre));
    // Se registra solo si el archivo termino completo
    await conexion.query('INSERT INTO schema_migraciones (archivo) VALUES (?)', [nombre]);
    aplicadas.push(nombre);
  }
  return aplicadas;
}

async function aplicarSeeds(
  conexion: Connection,
  directorioSql: string,
  incluirDemo: boolean,
): Promise<string[]> {
  const cargados: string[] = [];
  const directorio = path.join(directorioSql, 'seeds');
  for (const nombre of await listarSql(directorio)) {
    // Los seeds de demostracion llevan "_demo" en el nombre y solo se cargan si se pide
    if (!incluirDemo && nombre.includes('_demo')) {
      continue;
    }
    await ejecutarArchivo(conexion, path.join(directorio, nombre));
    cargados.push(nombre);
  }
  return cargados;
}

export async function ejecutarMigracion(opciones: OpcionesMigracion): Promise<ResultadoMigracion> {
  const { conexion: datos } = opciones;
  if (opciones.reiniciar === true && !datos.database.endsWith('_test')) {
    throw new Error(
      `Por seguridad solo se reinicia una base cuyo nombre termina en _test (recibida: ${datos.database})`,
    );
  }

  const conexion = await createConnection({
    host: datos.host,
    port: datos.port,
    user: datos.user,
    password: datos.password,
    database: datos.database,
    charset: 'utf8mb4',
    timezone: '-05:00',
  });

  try {
    await obtenerBloqueo(conexion);
    if (opciones.reiniciar === true) {
      await reiniciarEsquema(conexion);
    }

    const resultado: ResultadoMigracion = { migraciones: [], seeds: [] };
    if (opciones.modo !== 'seeds') {
      resultado.migraciones = await aplicarMigraciones(conexion, opciones.directorioSql);
    }
    if (opciones.modo !== 'migraciones') {
      resultado.seeds = await aplicarSeeds(conexion, opciones.directorioSql, opciones.incluirDemo);
    }
    return resultado;
  } finally {
    await conexion.end();
  }
}