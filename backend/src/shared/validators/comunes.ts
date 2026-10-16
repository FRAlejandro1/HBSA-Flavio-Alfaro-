// Esquemas Zod reutilizables por varios modulos.
import { z } from 'zod';
import { parsearFecha } from '../utils/fechas';

// Identificador de la URL (llega como texto y se convierte en numero)
export const esquemaId = z.object({ id: z.coerce.number().int().positive() });

// Fecha AAAA-MM-DD que ademas exista en el calendario (rechaza 2026-02-31)
export const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')
  .refine((valor) => {
    try {
      parsearFecha(valor);
      return true;
    } catch {
      return false;
    }
  }, 'La fecha no existe');