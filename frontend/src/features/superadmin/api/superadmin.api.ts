import { peticionApi } from '@/api/http';
import type {
  ObjetivoDias,
  RespuestaConfiguracionDias,
} from '@/features/superadmin/model/superadmin.types';

function identificadorValido(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

function rutaDias(objetivo: ObjetivoDias, id: number): string {
  return `/api/vacaciones/configuracion/${objetivo}/${id}/dias`;
}

export function obtenerDias(
  objetivo: ObjetivoDias,
  id: number,
): Promise<RespuestaConfiguracionDias> {
  if (!identificadorValido(id)) {
    return Promise.reject(new Error('El identificador no es válido.'));
  }

  return peticionApi<RespuestaConfiguracionDias>(rutaDias(objetivo, id), {
    autenticada: true,
  });
}

// null quita el valor propio: vuelve a heredar o a regir el valor por defecto
export function fijarDias(
  objetivo: ObjetivoDias,
  id: number,
  diasVacaciones: number | null,
): Promise<RespuestaConfiguracionDias> {
  if (!identificadorValido(id)) {
    return Promise.reject(new Error('El identificador no es válido.'));
  }

  return peticionApi<RespuestaConfiguracionDias>(rutaDias(objetivo, id), {
    method: 'PUT',
    autenticada: true,
    body: { diasVacaciones },
  });
}