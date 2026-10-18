// Esquema Zod de la configuracion de dias de vacaciones. Es estricto: un campo desconocido se rechaza.
import { z } from 'zod';

// Dias por periodo: positivos y de medio en medio dia; null quita el valor propio (se hereda o rige el por defecto).
// La clave es obligatoria: asi un cuerpo vacio no se confunde con "quitar".
export const esquemaDiasVacaciones = z
  .object({
    diasVacaciones: z.number().positive().max(366).multipleOf(0.5).nullable(),
  })
  .strict();

export type DiasVacacionesEntrada = z.infer<typeof esquemaDiasVacaciones>;