import { peticionApi } from '@/api/http';
import type { DatosSolicitudVacaciones } from '@/features/solicitud-vacaciones/model/solicitud-vacaciones.types';

export async function crearSolicitud(
  datos: DatosSolicitudVacaciones,
): Promise<void> {
  await peticionApi('/api/vacaciones/solicitudes', {
    method: 'POST',
    autenticada: true,
    body: datos,
  });
}