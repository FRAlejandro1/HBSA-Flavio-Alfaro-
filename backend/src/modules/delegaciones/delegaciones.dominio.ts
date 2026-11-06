// Contratos del dominio de delegaciones institucionales.
// Una delegación habilita temporalmente a otro usuario para atender los trámites del delegante.

export type EstadoDelegacion = 'PROGRAMADA' | 'VIGENTE' | 'VENCIDA' | 'REVOCADA';

export interface PersonaDelegacion {
  id: number;
  nombres: string;
  apellidos: string;
}

export interface Delegacion {
  id: number;
  delegante: PersonaDelegacion;
  delegado: PersonaDelegacion;
  creadaPorId: number;
  vigenteDesde: Date;
  vigenteHasta: Date;
  motivo: string | null;
  revocadaAt: Date | null;
  estado: EstadoDelegacion;
  creadaAt: Date;
}

export interface DatosCrearDelegacion {
  // Solo SUPERADMIN puede indicar un delegante distinto de su propia identidad.
  deleganteId?: number;
  delegadoId: number;
  vigenteDesde: Date;
  vigenteHasta: Date;
  motivo: string | null;
}

export interface FiltrosDelegaciones {
  deleganteId?: number;
  delegadoId?: number;
  estado?: EstadoDelegacion;
  pagina: number;
  porPagina: number;
}

export interface ResultadoListaDelegaciones {
  delegaciones: Delegacion[];
  total: number;
}

export interface IDelegacionesRepository {
  listar(
    empresaId: number,
    filtros: FiltrosDelegaciones,
  ): Promise<ResultadoListaDelegaciones>;

  obtener(empresaId: number, delegacionId: number): Promise<Delegacion | null>;

  crear(
    empresaId: number,
    actorId: number,
    datos: Required<DatosCrearDelegacion>,
  ): Promise<Delegacion>;

  revocar(
    empresaId: number,
    delegacionId: number,
    actorId: number,
    revocadaAt: Date,
  ): Promise<Delegacion>;
}