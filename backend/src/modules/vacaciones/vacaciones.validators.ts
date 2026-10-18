// Esquemas Zod de la entrada de vacaciones. Son estrictos: un campo desconocido (por ejemplo empresaId,
// usuarioId, estado o la fecha de la solicitud) se rechaza, porque los pone el servidor.
import { z } from 'zod';
import { fechaIso } from '../../shared/validators/comunes';

const telefono = z.string().trim().regex(/^[0-9+()\- ]{7,20}$/, 'Telefono invalido');
const justificacion = z.string().trim().min(1).max(500);
const motivo = z.string().trim().min(1).max(500);

export const esquemaCrearSolicitud = z
  .object({
    fechaInicio: fechaIso,
    fechaFin: fechaIso,
    // Si no viene se usa el telefono registrado de la persona
    telefonoLocalizacion: telefono.nullable().optional(),
    // Obligatoria cuando la solicitud no es programada (lo exige el service)
    justificacion: justificacion.nullable().optional(),
  })
  .strict()
  // Las fechas AAAA-MM-DD se comparan bien como texto
  .refine((datos) => datos.fechaFin >= datos.fechaInicio, {
    message: 'La fecha final no puede ser anterior a la inicial',
    path: ['fechaFin'],
  });

// Aprobar, negar y cancelar: el motivo es opcional y el cuerpo puede venir vacio o no venir
export const esquemaDecision = z
  .object({
    motivo: motivo.nullable().optional(),
  })
  .strict()
  .default({});

export const esquemaFiltrosSolicitudes = z
  .object({
    estado: z.enum(['PENDIENTE', 'VISTO_BUENO', 'AUTORIZADA', 'NEGADA', 'CANCELADA']).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CrearSolicitudEntrada = z.infer<typeof esquemaCrearSolicitud>;
export type DecisionEntrada = z.infer<typeof esquemaDecision>;
export type FiltrosSolicitudesEntrada = z.infer<typeof esquemaFiltrosSolicitudes>;