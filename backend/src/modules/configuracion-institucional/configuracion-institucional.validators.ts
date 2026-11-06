// Validaciones de entrada para la configuracion institucional.
// Rechaza campos adicionales y comprueba los limites de cada parametro.

import { z } from 'zod';
import { esZonaHorariaValida } from '../../shared/utils/zonaHoraria';

export const esquemaActualizarConfiguracionInstitucional = z.object({
  plazoHoras: z.number().positive().max(999.99).multipleOf(0.01),
  diasVacacionesAnuales: z.number().positive().max(366).multipleOf(0.01),
  zonaHoraria: z.string().trim().min(1).max(64).refine(
    esZonaHorariaValida,
    'La zona horaria indicada no es valida',
  ),
  diasAnticipacionVacaciones: z.number().int().min(0).max(365),
}).strict();

export type EntradaActualizarConfiguracionInstitucional = z.infer<
  typeof esquemaActualizarConfiguracionInstitucional
>;