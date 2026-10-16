// Errores de dominio tipados. Los services lanzan AppError y solo errorHandler
// los traduce a una respuesta HTTP: ninguna otra capa conoce codigos de estado.

// Codigos estables que consume el frontend para decidir que mostrar
export type CodigoError =
  | 'VALIDACION'
  | 'NO_AUTENTICADO'
  | 'PROHIBIDO'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'REGLA_DE_NEGOCIO'
  | 'DEMASIADAS_PETICIONES'
  | 'ERROR_INTERNO';

// Estado HTTP que le corresponde a cada codigo
const ESTADO_HTTP: Record<CodigoError, number> = {
  VALIDACION: 400,
  NO_AUTENTICADO: 401,
  PROHIBIDO: 403,
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  REGLA_DE_NEGOCIO: 422,
  DEMASIADAS_PETICIONES: 429,
  ERROR_INTERNO: 500,
};

export class AppError extends Error {
  readonly codigo: CodigoError;
  readonly estado: number;
  readonly detalles: unknown;

  constructor(codigo: CodigoError, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'AppError';
    this.codigo = codigo;
    this.estado = ESTADO_HTTP[codigo];
    this.detalles = detalles;
  }

  // Entrada invalida (formato, campos faltantes)
  static validacion(mensaje: string, detalles?: unknown): AppError {
    return new AppError('VALIDACION', mensaje, detalles);
  }

  // Sin sesion o sesion invalida
  static noAutenticado(mensaje = 'Sesion no valida'): AppError {
    return new AppError('NO_AUTENTICADO', mensaje);
  }

  // Sesion valida pero sin permiso para la accion
  static prohibido(mensaje = 'No tienes permiso para esta accion'): AppError {
    return new AppError('PROHIBIDO', mensaje);
  }

  // El recurso no existe (o pertenece a otro hospital)
  static noEncontrado(mensaje = 'Recurso no encontrado'): AppError {
    return new AppError('NO_ENCONTRADO', mensaje);
  }

  // El estado actual impide la accion (duplicados, transicion invalida)
  static conflicto(mensaje: string, detalles?: unknown): AppError {
    return new AppError('CONFLICTO', mensaje, detalles);
  }

  // Se incumple una regla del negocio (saldo insuficiente, fechas invalidas)
  static reglaDeNegocio(mensaje: string, detalles?: unknown): AppError {
    return new AppError('REGLA_DE_NEGOCIO', mensaje, detalles);
  }
}