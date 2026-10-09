// Esquemas Zod de la entrada de autenticacion. Zod limpia los datos antes de que lleguen al service.
import { z } from 'zod';
import { LONGITUD_MAXIMA_CLAVE } from '../../shared/security/password';

export const esquemaLogin = z.object({
  // El correo se normaliza (sin espacios y en minusculas) para que coincida con el guardado
  correo: z.string().trim().toLowerCase().email().max(150),
  // En el login solo se limita el maximo: la longitud minima se exige al crear la clave, no al usarla
  clave: z.string().min(1).max(LONGITUD_MAXIMA_CLAVE),
});

export type LoginEntrada = z.infer<typeof esquemaLogin>;