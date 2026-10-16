// Utilidades para las pruebas con MySQL y Redis reales: datos de partida, personas de prueba y limpieza.
import { createConnection } from 'mysql2/promise';
import { obtenerBaseDatos } from '../../src/config/database';
import { env } from '../../src/config/env';
import { obtenerRedis } from '../../src/config/redis';
import type { CodigoRol } from '../../src/shared/types/roles';
import { conexionPruebas } from '../setup/entornoDb';

// Identificadores de los datos de partida: dos hospitales (A y B), cada uno con sus areas y cargos
export const IDS = {
  empresaA: 1,
  empresaB: 2,
  areaA1: 1,
  areaA2: 2,
  areaB1: 3,
  cargoA1: 1,
  cargoA2: 2,
  cargoB1: 3,
} as const;

// Tablas que se vacian entre pruebas (roles y schema_migraciones se conservan)
const TABLAS = [
  'audit_log',
  'documentos_pdf',
  'notificaciones',
  'permisos_hora',
  'solicitud_descuentos',
  'solicitudes_vacaciones',
  'secuencias_tramite',
  'periodos_vacaciones',
  'feriados',
  'usuarios',
  'areas',
  'cargos',
  'empresas',
  'direcciones_provinciales',
  'zonas',
];

const DATOS_DE_PARTIDA = `
  INSERT INTO zonas (id, detalle) VALUES (1, 'Zona 4');
  INSERT INTO direcciones_provinciales (id, zona_id, detalle) VALUES (1, 1, 'Direccion de pruebas');
  INSERT INTO empresas (id, direccion_provincial_id, nombre, lugar) VALUES
    (1, 1, 'Hospital A', 'Ciudad A'),
    (2, 1, 'Hospital B', 'Ciudad B');
  INSERT INTO areas (id, empresa_id, detalle) VALUES
    (1, 1, 'Emergencia'),
    (2, 1, 'Consulta Externa'),
    (3, 2, 'Quirofano');
  INSERT INTO cargos (id, empresa_id, detalle, responsabilidad, funciones) VALUES
    (1, 1, 'Medico', 'Responsabilidad de prueba', 'Funciones de prueba'),
    (2, 1, 'Enfermera', 'Responsabilidad de prueba', 'Funciones de prueba'),
    (3, 2, 'Auxiliar', 'Responsabilidad de prueba', 'Funciones de prueba');
`;

// Vacia las tablas y vuelve a insertar los datos de partida (los ids siempre son los de IDS)
export async function resetearDatos(): Promise<void> {
  const conexion = await createConnection({
    ...conexionPruebas,
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of TABLAS) {
      await conexion.query(`TRUNCATE TABLE \`${tabla}\``);
    }
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
    await conexion.query(DATOS_DE_PARTIDA);
  } finally {
    await conexion.end();
  }
}

// Vacia la base de Redis de pruebas; se niega a hacerlo fuera del entorno de pruebas
export async function limpiarRedis(): Promise<void> {
  if (env.NODE_ENV !== 'test') {
    throw new Error('limpiarRedis solo se puede usar con NODE_ENV=test');
  }
  await obtenerRedis().flushdb();
}

export interface DatosUsuarioDePrueba {
  empresaId: number;
  areaId: number;
  cargoId: number;
  cedula: string;
  rol?: CodigoRol;
  correo?: string | null;
  passwordHash?: string | null;
  nombres?: string;
  apellidos?: string;
}

// Inserta una persona directamente (sin pasar por el service) y devuelve su id
export async function insertarUsuario(datos: DatosUsuarioDePrueba): Promise<number> {
  const resultado = await obtenerBaseDatos().ejecutar(
    `INSERT INTO usuarios
       (empresa_id, area_id, cargo_id, rol_id, cedula, nombres, apellidos, email, password_hash, fecha_ingreso)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, ?, ?, ?, ?, '2020-01-01')`,
    [
      datos.empresaId,
      datos.areaId,
      datos.cargoId,
      datos.rol ?? 'EMPLEADO',
      datos.cedula,
      datos.nombres ?? 'Prueba',
      datos.apellidos ?? 'Persona',
      datos.correo ?? null,
      datos.passwordHash ?? null,
    ],
  );
  return resultado.idInsertado;
}