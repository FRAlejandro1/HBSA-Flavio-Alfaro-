// Validaciones de entrada para la administracion de delegaciones institucionales.

import { z } from 'zod';

const esquemaIdPositivo = z.number().int().positive();

const esquemaFecha = z
  .string()
  .datetime({ offset: true })
  .transform((valor) => new Date(valor));

export const esquemaCrearDelegacion = z
  .object({
    deleganteId: esquemaIdPositivo.optional(),
    delegadoId: esquemaIdPositivo,
    vigenteDesde: esquemaFecha,
    vigenteHasta: esquemaFecha,
    motivo: z.string().trim().max(300).nullable().optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.vigenteHasta.getTime() <= datos.vigenteDesde.getTime()) {
      contexto.addIssue({
        code: 'custom',
        path: ['vigenteHasta'],
        message: 'La fecha de finalizacion debe ser posterior a la fecha de inicio',
      });
    }
  })
  .transform((datos) => ({
    ...datos,
    motivo: datos.motivo ?? null,
  }));

export const esquemaFiltrosDelegaciones = z.object({
  deleganteId: z.coerce.number().int().positive().optional(),
  delegadoId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['PROGRAMADA', 'VIGENTE', 'VENCIDA', 'REVOCADA']).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export type CrearDelegacionEntrada = z.infer<typeof esquemaCrearDelegacion>;
export type FiltrosDelegacionesEntrada = z.infer<typeof esquemaFiltrosDelegaciones>;