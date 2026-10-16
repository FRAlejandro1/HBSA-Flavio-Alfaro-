// Tipos del dominio de organizacion: areas y cargos de un hospital. No dependen de Express ni de MySQL.

// Jefe de un area, tal como se muestra en las listas
export interface JefeArea {
  id: number;
  nombres: string;
  apellidos: string;
}

export interface Area {
  id: number;
  detalle: string;
  jefe: JefeArea | null;
}

// Responsabilidad y funciones se imprimen en la solicitud de vacaciones
export interface Cargo {
  id: number;
  detalle: string;
  responsabilidad: string;
  funciones: string;
}

export interface DatosArea {
  detalle: string;
  jefeId: number | null;
}

// En una actualizacion solo viajan los campos que cambian; jefeId en null quita al jefe
export interface CambiosArea {
  detalle?: string;
  jefeId?: number | null;
}

export interface DatosCargo {
  detalle: string;
  responsabilidad: string;
  funciones: string;
}

export type CambiosCargo = Partial<DatosCargo>;