// Traduce los errores de la base de datos que el usuario puede provocar (duplicados, registros en uso,
// referencias invalidas) a AppError. Lo usan los repositories, que son los unicos que conocen el motor.
import { AppError } from './AppError';

// Mensajes propios de cada recurso para cada tipo de error
export interface MensajesErrorBD {
  duplicado?: string;
  enUso?: string;
  referenciaInvalida?: string;
}

// Los errores de mysql2 traen el nombre del error en la propiedad "code"
function codigoDe(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : undefined;
  }
  return undefined;
}

// Devuelve siempre un Error listo para lanzar: AppError si lo reconoce, el original si no
export function traducirErrorBD(error: unknown, mensajes: MensajesErrorBD): Error {
  switch (codigoDe(error)) {
    // Violacion de una restriccion unica
    case 'ER_DUP_ENTRY':
      return AppError.conflicto(mensajes.duplicado ?? 'Ya existe un registro igual');
    // Se intento borrar algo que otra tabla todavia referencia
    case 'ER_ROW_IS_REFERENCED_2':
      return AppError.conflicto(mensajes.enUso ?? 'El registro esta en uso y no se puede eliminar');
    // Se indico una referencia que no existe (o que es de otro hospital)
    case 'ER_NO_REFERENCED_ROW_2':
      return AppError.reglaDeNegocio(
        mensajes.referenciaInvalida ?? 'Una referencia indicada no existe en este hospital',
      );
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}