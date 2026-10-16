// Esquemas Zod de la entrada de organizacion. Son estrictos: un campo desconocido (por ejemplo
// empresaId) se rechaza, asi nadie puede intentar escribir en otro hospital.
import { z } from 'zod';

const detalle = z.string().trim().min(1).max(150);
const texto = z.string().trim().min(1).max(2000);
const idPositivo = z.number().int().positive();

// Identificador de la URL (llega como texto y se convierte en numero)
export const esquemaId = z.object({ id: z.coerce.number().int().positive() });

export const esquemaCrearArea = z
  .object({
    detalle,
    jefeId: idPositivo.nullable().default(null),
  })
  .strict();

export const esquemaActualizarArea = z
  .object({
    detalle: detalle.optional(),
    jefeId: idPositivo.nullable().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo para actualizar');

export const esquemaCrearCargo = z
  .object({
    detalle,
    responsabilidad: texto,
    funciones: texto,
  })
  .strict();

export const esquemaActualizarCargo = z
  .object({
    detalle: detalle.optional(),
    responsabilidad: texto.optional(),
    funciones: texto.optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo para actualizar');

export type CrearAreaEntrada = z.infer<typeof esquemaCrearArea>;
export type ActualizarAreaEntrada = z.infer<typeof esquemaActualizarArea>;
export type CrearCargoEntrada = z.infer<typeof esquemaCrearCargo>;
export type ActualizarCargoEntrada = z.infer<typeof esquemaActualizarCargo>;