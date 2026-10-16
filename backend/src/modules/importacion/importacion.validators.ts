// Esquemas Zod de los campos de texto que acompanan al archivo (multipart/form-data).
import { z } from 'zod';
import { CAMPOS_IMPORTACION } from './importacion.dominio';
import type { MapeoColumnas } from './importacion.dominio';

// { "cedula": "Identificación", "area": "Unidad" }: campo del sistema -> encabezado exacto del archivo
const esquemaMapeo = z.record(z.enum(CAMPOS_IMPORTACION), z.string().trim().min(1).max(200));

// El mapeo llega como texto JSON dentro del formulario
const mapeoDesdeTexto = z
  .string()
  .max(4000)
  .optional()
  .transform((texto, contexto): MapeoColumnas => {
    if (texto === undefined || texto.trim() === '') {
      return {};
    }
    try {
      const resultado = esquemaMapeo.safeParse(JSON.parse(texto));
      if (resultado.success) {
        return resultado.data;
      }
    } catch {
      // El texto no era JSON: se informa abajo
    }
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'El mapeo de columnas no es válido' });
    return z.NEVER;
  });

const bajaAusentes = z
  .enum(['true', 'false'])
  .default('false')
  .transform((valor) => valor === 'true');

export const esquemaRevision = z.object({ mapeo: mapeoDesdeTexto, bajaAusentes }).strict();

export const esquemaAplicacion = z
  .object({
    mapeo: mapeoDesdeTexto,
    bajaAusentes,
    huella: z.string().regex(/^[0-9a-f]{64}$/, 'La huella no es válida'),
  })
  .strict();

export type RevisionEntrada = z.infer<typeof esquemaRevision>;
export type AplicacionEntrada = z.infer<typeof esquemaAplicacion>;