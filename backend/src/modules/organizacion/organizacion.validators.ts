// Esquemas Zod de la entrada de organizacion. Son estrictos: un campo desconocido (por ejemplo
// empresaId) se rechaza, asi nadie puede intentar escribir en otro hospital.
import { z } from 'zod';

const detalle = z.string().trim().min(1).max(150);
const texto = z.string().trim().min(1).max(2000);
const idPositivo = z.number().int().positive();
const rolPuesto = z.string().trim().min(1).max(60);
// Grado del puesto en la escala del MSP (1 al 6)
const grado = z.number().int().min(1).max(6);
// 1 maxima autoridad ... 5 operativo (por defecto)
const nivelJerarquico = z.number().int().min(1).max(5);

// Identificador de la URL (llega como texto y se convierte en numero)
export const esquemaId = z.object({ id: z.coerce.number().int().positive() });

export const esquemaCrearArea = z
  .object({
    detalle,
    jefeId: idPositivo.nullable().default(null),
    parentId: idPositivo.nullable().default(null),
    procesoId: idPositivo.nullable().default(null),
  })
  .strict();

// El proceso no se actualiza: lo fija el area principal al crearse y las subareas lo heredan
export const esquemaActualizarArea = z
  .object({
    detalle: detalle.optional(),
    jefeId: idPositivo.nullable().optional(),
    parentId: idPositivo.nullable().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo para actualizar');

export const esquemaCrearCargo = z
  .object({
    detalle,
    grado: grado.nullable().default(null),
    rolPuesto: rolPuesto.nullable().default(null),
    nivelJerarquico: nivelJerarquico.default(5),
    responsabilidad: texto,
    funciones: texto,
  })
  .strict();

export const esquemaActualizarCargo = z
  .object({
    detalle: detalle.optional(),
    grado: grado.nullable().optional(),
    rolPuesto: rolPuesto.nullable().optional(),
    nivelJerarquico: nivelJerarquico.optional(),
    responsabilidad: texto.optional(),
    funciones: texto.optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo para actualizar');

export type CrearAreaEntrada = z.infer<typeof esquemaCrearArea>;
export type ActualizarAreaEntrada = z.infer<typeof esquemaActualizarArea>;
export type CrearCargoEntrada = z.infer<typeof esquemaCrearCargo>;
export type ActualizarCargoEntrada = z.infer<typeof esquemaActualizarCargo>;