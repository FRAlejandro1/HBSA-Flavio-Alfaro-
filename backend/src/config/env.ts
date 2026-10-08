// Carga y valida las variables de entorno con Zod al arrancar.
// Si falta o es invalida alguna, el proceso falla de inmediato con un mensaje claro.
// Ningun otro archivo lee process.env: todo pasa por el objeto "env" de aqui.
import { z } from 'zod';

// Esquema de todas las variables que usa el backend
const esquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug']).default('info'),

    // Lista de origenes permitidos por CORS, separados por comas
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((valor) =>
        valor
          .split(',')
          .map((origen) => origen.trim())
          .filter((origen) => origen.length > 0),
      ),

    // Base de datos MySQL
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    DB_POOL_LIMIT: z.coerce.number().int().min(1).default(10),

    // Redis
    REDIS_URL: z.string().url(),

    // JWT: secretos largos, distintos entre si
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().min(2),
    JWT_REFRESH_TTL: z.string().min(2),

    // Cookie del refresh token
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((valor) => valor === 'true'),

    // Limites de peticiones por ventana de tiempo
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),

    // Regla de negocio configurable: dias laborables de vacaciones por periodo
    DIAS_VACACIONES_ANUALES: z.coerce.number().positive().default(30),
  })
  .superRefine((valores, contexto) => {
    // Un secreto comprometido no debe poder firmar el otro tipo de token
    if (valores.JWT_ACCESS_SECRET === valores.JWT_REFRESH_SECRET) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'Debe ser distinto de JWT_ACCESS_SECRET',
      });
    }
    // En produccion la cookie del refresh solo viaja por HTTPS
    if (valores.NODE_ENV === 'production' && !valores.COOKIE_SECURE) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'Debe ser true en produccion',
      });
    }
  });

export type Env = z.infer<typeof esquemaEnv>;

// Valida una fuente de variables (process.env en ejecucion, un objeto en las pruebas)
export function cargarEnv(fuente: NodeJS.ProcessEnv): Env {
  const resultado = esquemaEnv.safeParse(fuente);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `- ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${detalle}`);
  }
  return resultado.data;
}

// Configuracion validada y tipada, lista para importar
export const env: Env = cargarEnv(process.env);