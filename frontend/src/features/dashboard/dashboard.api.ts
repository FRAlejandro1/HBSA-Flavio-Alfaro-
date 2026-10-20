import { peticionApi } from '@/api/http';
import type { RespuestaSolicitudes } from './dashboard.types';

export function listarSolicitudes(): Promise<RespuestaSolicitudes> {
  return peticionApi<RespuestaSolicitudes>(
    '/api/vacaciones/solicitudes?pagina=1&porPagina=20',
    { autenticada: true },
  );
}
