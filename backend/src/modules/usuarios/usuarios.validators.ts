// Esquemas Zod de la entrada de usuarios. Son estrictos: un campo desconocido (por ejemplo empresaId)
// se rechaza, asi nadie puede intentar escribir en otro hospital.
import { z } from 'zod';
import { LONGITUD_MAXIMA_CLAVE, LONGITUD_MINIMA_CLAVE } from '../../shared/security/password';
import { ROLES } from '../../shared/types/roles';
import { fechaIso } from '../../shared/validators/comunes';

const cedula = z.string().trim().regex(/^\d{10}$/, 'La cedula debe tener 10 digitos');
const nombre = z.string().trim().min(1).max(100);
// El correo se normaliza para que coincida con el guardado y con el del login
const correo = z.string().trim().toLowerCase().email().max(150);
const telefono = z.string().trim().regex(/^[0-9+()\- ]{7,20}$/, 'Telefono invalido');
const idPositivo = z.number().int().positive();
const clave = z.string().min(LONGITUD_MINIMA_CLAVE).max(LONGITUD_MAXIMA_CLAVE);

export const esquemaCrearUsuario = z
  .object({
    cedula,
    nombres: nombre,
    apellidos: nombre,
    correo: correo.nullable().optional(),
    telefono: telefono.nullable().optional(),
    areaId: idPositivo,
    cargoId: idPositivo,
    rol: z.enum(ROLES).default('EMPLEADO'),
    jefeInmediatoId: idPositivo.nullable().default(null),
    fechaIngreso: fechaIso,
    // Con clave la persona tiene cuenta de acceso (y entonces el correo es obligatorio)
    clave: clave.optional(),
  })
  .strict();

export const esquemaActualizarUsuario = z
  .object({
    cedula: cedula.optional(),
    nombres: nombre.optional(),
    apellidos: nombre.optional(),
    correo: correo.nullable().optional(),
    telefono: telefono.nullable().optional(),
    areaId: idPositivo.optional(),
    cargoId: idPositivo.optional(),
    rol: z.enum(ROLES).optional(),
    jefeInmediatoId: idPositivo.nullable().optional(),
    fechaIngreso: fechaIso.optional(),
    // Una clave nueva la cambia; null quita el acceso
    clave: clave.nullable().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo para actualizar');

export const esquemaFiltrosUsuarios = z
  .object({
    busqueda: z.string().trim().max(100).optional(),
    areaId: z.coerce.number().int().positive().optional(),
    estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// Sin cuerpo, la baja es "hoy"
export const esquemaBaja = z.object({ fechaBaja: fechaIso.optional() }).strict().default({});

export type CrearUsuarioEntrada = z.infer<typeof esquemaCrearUsuario>;
export type ActualizarUsuarioEntrada = z.infer<typeof esquemaActualizarUsuario>;
export type FiltrosUsuariosEntrada = z.infer<typeof esquemaFiltrosUsuarios>;
export type BajaEntrada = z.infer<typeof esquemaBaja>;