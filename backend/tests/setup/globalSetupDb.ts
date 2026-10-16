// Se ejecuta una vez antes de las pruebas con base de datos real: borra el esquema de la base de pruebas
// y lo reconstruye con las migraciones y los seeds base (roles). Nunca carga datos de demostracion.
import path from 'node:path';
import { ejecutarMigracion } from '../../src/scripts/migrador';
import { conexionPruebas } from './entornoDb';

export default async function prepararBaseDeDatos(): Promise<void> {
  await ejecutarMigracion({
    conexion: conexionPruebas,
    directorioSql: path.resolve(__dirname, '../../../database'),
    modo: 'todo',
    incluirDemo: false,
    // El migrador rechaza reiniciar si el nombre de la base no termina en _test
    reiniciar: true,
  });
}