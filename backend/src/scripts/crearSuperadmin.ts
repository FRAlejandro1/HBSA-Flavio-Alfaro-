// Crea el primer SUPERADMIN de un hospital (alguien debe poder entrar antes de que existan usuarios).
// Los datos llegan por variables de entorno para no quedar en archivos; la clave se guarda con Argon2id.
// Uso: ver "crear-superadmin" en package.json y la seccion de comandos del README.
import { ZodError, z } from 'zod';
import { cerrarBaseDatos, obtenerBaseDatos } from '../config/database';
import { logger } from '../config/logger';
import {
  LONGITUD_MAXIMA_CLAVE,
  LONGITUD_MINIMA_CLAVE,
  hashearClave,
} from '../shared/security/password';

const esquemaEntrada = z.object({
  SUPERADMIN_CORREO: z.string().trim().toLowerCase().email().max(150),
  SUPERADMIN_CLAVE: z.string().min(LONGITUD_MINIMA_CLAVE).max(LONGITUD_MAXIMA_CLAVE),
  SUPERADMIN_NOMBRES: z.string().trim().min(1).max(100),
  SUPERADMIN_APELLIDOS: z.string().trim().min(1).max(100),
  SUPERADMIN_CEDULA: z.string().trim().regex(/^\d{10}$/, 'La cedula debe tener 10 digitos'),
  SUPERADMIN_EMPRESA_ID: z.coerce.number().int().positive(),
  SUPERADMIN_AREA_ID: z.coerce.number().int().positive(),
  SUPERADMIN_CARGO_ID: z.coerce.number().int().positive(),
});

async function crearSuperadmin(): Promise<void> {
  const entrada = esquemaEntrada.parse(process.env);
  const bd = obtenerBaseDatos();

  // No se duplican ni el correo (unico en todo el sistema) ni la cedula dentro del hospital
  const existentes = await bd.consultar<{ id: number }>(
    'SELECT id FROM usuarios WHERE email = ? OR (empresa_id = ? AND cedula = ?) LIMIT 1',
    [entrada.SUPERADMIN_CORREO, entrada.SUPERADMIN_EMPRESA_ID, entrada.SUPERADMIN_CEDULA],
  );
  if (existentes.length > 0) {
    throw new Error('Ya existe un usuario con ese correo o esa cedula');
  }

  const [rol] = await bd.consultar<{ id: number }>(
    "SELECT id FROM roles WHERE codigo = 'SUPERADMIN' LIMIT 1",
  );
  if (!rol) {
    throw new Error('No existe el rol SUPERADMIN: carga los seeds con migrar.sh');
  }

  const passwordHash = await hashearClave(entrada.SUPERADMIN_CLAVE);

  // Las claves foraneas compuestas rechazan un area o cargo que no sea del hospital indicado
  const resultado = await bd.ejecutar(
    `INSERT INTO usuarios
       (empresa_id, area_id, cargo_id, rol_id, cedula, nombres, apellidos, email, password_hash, fecha_ingreso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      entrada.SUPERADMIN_EMPRESA_ID,
      entrada.SUPERADMIN_AREA_ID,
      entrada.SUPERADMIN_CARGO_ID,
      rol.id,
      entrada.SUPERADMIN_CEDULA,
      entrada.SUPERADMIN_NOMBRES,
      entrada.SUPERADMIN_APELLIDOS,
      entrada.SUPERADMIN_CORREO,
      passwordHash,
    ],
  );

  logger.info('SUPERADMIN creado', {
    usuarioId: resultado.idInsertado,
    empresaId: entrada.SUPERADMIN_EMPRESA_ID,
  });
  process.stdout.write(`SUPERADMIN creado con id ${resultado.idInsertado}\n`);
}

// Resume el error para la terminal sin imprimir datos sensibles
function describirError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`).join('\n');
  }
  return error instanceof Error ? error.message : String(error);
}

void crearSuperadmin()
  .catch((error: unknown) => {
    process.stderr.write(`No se pudo crear el SUPERADMIN:\n${describirError(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarBaseDatos();
  });