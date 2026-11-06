import { peticionApi } from '@/api/http';
import type {
  RespuestaSolicitudDetalle,
  RespuestaSolicitudes,
} from '@/features/dashboard/model/dashboard.types';

export function listarSolicitudes(): Promise<RespuestaSolicitudes> {
  return peticionApi<RespuestaSolicitudes>(
    '/api/vacaciones/solicitudes?pagina=1&porPagina=20',
    { autenticada: true },
  );
}

export function obtenerSolicitud(
  id: number,
): Promise<RespuestaSolicitudDetalle> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Promise.reject(
      new Error('El identificador de la solicitud no es válido.'),
    );
  }

  return peticionApi<RespuestaSolicitudDetalle>(
    `/api/vacaciones/solicitudes/${id}`,
    { autenticada: true },
  );
}