// Tipos del dominio de organizacion: areas, procesos y cargos de un hospital. No dependen de Express ni de MySQL.

// Jefe de un area, tal como se muestra en las listas
export interface JefeArea {
  id: number;
  nombres: string;
  apellidos: string;
}

// Proceso institucional del MSP (catalogo global): gobernante, agregador de valor, habilitante de asesoria o de apoyo
export interface Proceso {
  id: number;
  codigo: string;
  detalle: string;
}

// Un area puede tener subareas (parentId). procesoId solo es null en areas anteriores a la clasificacion por procesos
export interface Area {
  id: number;
  detalle: string;
  jefe: JefeArea | null;
  parentId: number | null;
  procesoId: number | null;
}

// Area con sus subareas anidadas, para pintar la estructura del hospital
export interface NodoArea extends Area {
  hijos: NodoArea[];
}

// Responsabilidad y funciones se imprimen en la solicitud de vacaciones
// nivelJerarquico: 1 maxima autoridad, 2 subdireccion, 3 jefatura de area o gestion, 4 jefatura de subarea o coordinacion, 5 operativo
export interface Cargo {
  id: number;
  detalle: string;
  grado: number | null;
  rolPuesto: string | null;
  nivelJerarquico: number;
  responsabilidad: string;
  funciones: string;
}

// parentId en null crea un area principal, que debe indicar su proceso; una subarea hereda el de su padre
export interface DatosArea {
  detalle: string;
  jefeId: number | null;
  parentId: number | null;
  procesoId: number | null;
}

// En una actualizacion solo viajan los campos que cambian; jefeId en null quita al jefe y parentId en null la vuelve area principal
// El proceso no se cambia: lo define el area principal al crearse
export interface CambiosArea {
  detalle?: string;
  jefeId?: number | null;
  parentId?: number | null;
}

export interface DatosCargo {
  detalle: string;
  grado: number | null;
  rolPuesto: string | null;
  nivelJerarquico: number;
  responsabilidad: string;
  funciones: string;
}

export type CambiosCargo = Partial<DatosCargo>;