// Tipos, campos y sinonimos del dominio de importacion de personal. No dependen de Express ni de MySQL.
import type { CodigoRol } from '../../shared/types/roles';
import type { EstadoUsuario } from '../usuarios/usuarios.dominio';
import type { TipoArchivo } from './lectores/tipos';

// Datos que puede traer una columna del archivo
export const CAMPOS_IMPORTACION = [
  'cedula',
  'nombres',
  'apellidos',
  'correo',
  'telefono',
  'area',
  'cargo',
  'cedulaJefe',
  'fechaIngreso',
  'rol',
  'fechaBaja',
] as const;

export type CampoImportacion = (typeof CAMPOS_IMPORTACION)[number];

export const ETIQUETAS_CAMPO: Record<CampoImportacion, string> = {
  cedula: 'Cédula',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  correo: 'Correo',
  telefono: 'Teléfono',
  area: 'Área',
  cargo: 'Cargo',
  cedulaJefe: 'Cédula del jefe inmediato',
  fechaIngreso: 'Fecha de ingreso',
  rol: 'Rol',
  fechaBaja: 'Fecha de baja',
};

// Sin estas columnas no se puede importar
export const CAMPOS_OBLIGATORIOS: readonly CampoImportacion[] = [
  'cedula',
  'nombres',
  'apellidos',
  'area',
  'cargo',
  'fechaIngreso',
];

// "Cédula del jefe", "CI jefe inmediato", "Identificación del supervisor"...: hay demasiadas formas de escribirlo
// para listarlas a mano, asi que se combinan los nombres del documento con los del jefe (ya normalizados)
const PREFIJOS_DOCUMENTO = ['cedula', 'ci', 'identificacion', 'documento', 'nroidentificacion', 'numeroidentificacion'];
const SUFIJOS_JEFE = [
  'jefe',
  'jefeinmediato',
  'jefedirecto',
  'deljefe',
  'deljefeinmediato',
  'deljefedirecto',
  'supervisor',
  'delsupervisor',
];
const CEDULA_DEL_JEFE = PREFIJOS_DOCUMENTO.flatMap((prefijo) =>
  SUFIJOS_JEFE.map((sufijo) => `${prefijo}${sufijo}`),
);

// Nombres con que suele aparecer cada columna, ya normalizados (sin tildes, mayusculas, espacios ni signos)
export const SINONIMOS: Record<CampoImportacion, readonly string[]> = {
  cedula: ['cedula', 'ci', 'cedulaidentidad', 'cedulaciudadania', 'identificacion', 'nroidentificacion', 'numeroidentificacion', 'documento', 'dni', 'nocedula', 'numerocedula'],
  nombres: ['nombres', 'nombre', 'primernombre', 'nombresservidor'],
  apellidos: ['apellidos', 'apellido'],
  correo: ['correo', 'correoelectronico', 'email', 'mail', 'correoinstitucional', 'emailinstitucional'],
  telefono: ['telefono', 'celular', 'movil', 'telefonocelular', 'contacto', 'telefonocontacto'],
  area: ['area', 'unidad', 'departamento', 'servicio', 'unidadadministrativa', 'areadetrabajo', 'unidadalaquepertenece', 'gestioninterna'],
  cargo: ['cargo', 'puesto', 'denominaciondelpuesto', 'denominacionpuesto', 'funcion', 'puestoinstitucional'],
  cedulaJefe: CEDULA_DEL_JEFE,
  fechaIngreso: ['fechaingreso', 'fechadeingreso', 'ingreso', 'fechainicio', 'fechadeinicio', 'iniciolabores', 'fechacontratacion', 'fechadecontratacion'],
  rol: ['rol', 'perfil', 'rolsistema'],
  fechaBaja: ['fechabaja', 'fechadebaja', 'fechasalida', 'fechadesalida', 'bajafecha'],
};

// Rol escrito en el archivo (normalizado) -> rol del sistema
export const ROLES_POR_TEXTO: Record<string, CodigoRol> = {
  superadmin: 'SUPERADMIN',
  administrador: 'SUPERADMIN',
  talentohumano: 'TALENTO_HUMANO',
  th: 'TALENTO_HUMANO',
  jefedearea: 'JEFE_AREA',
  jefearea: 'JEFE_AREA',
  jefe: 'JEFE_AREA',
  empleado: 'EMPLEADO',
  servidor: 'EMPLEADO',
};

// Que columna del archivo (por su encabezado exacto) corresponde a cada dato
export type MapeoColumnas = Partial<Record<CampoImportacion, string>>;

export type AccionFila = 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS' | 'BAJA' | 'OMITIR' | 'ERROR';

export interface ColumnaDetectada {
  indice: number;
  encabezado: string;
  campo: CampoImportacion | null;
}

export interface FilaRevisada {
  // Numero de fila en el archivo (la 1 es la de encabezados)
  fila: number;
  cedula: string | null;
  nombre: string;
  accion: AccionFila;
  errores: string[];
  advertencias: string[];
}

export interface ResumenImportacion {
  crear: number;
  actualizar: number;
  sinCambios: number;
  baja: number;
  omitidas: number;
  conErrores: number;
  ausentes: number;
}

export interface ItemCatalogo {
  id: number;
  detalle: string;
}

// Persona que ya esta en el hospital
export interface UsuarioExistente {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  areaId: number;
  cargoId: number;
  rol: CodigoRol;
  jefeCedula: string | null;
  fechaIngreso: string;
  estado: EstadoUsuario;
  fechaBaja: string | null;
}

export interface NuevaPersona {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  areaId: number;
  cargoId: number;
  rol: CodigoRol;
  fechaIngreso: string;
}

// Solo los datos que cambian; el jefe se resuelve aparte porque puede ser alguien que se crea en la misma importacion
export interface CambiosPersona {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
  areaId?: number;
  cargoId?: number;
  rol?: CodigoRol;
  fechaIngreso?: string;
}

// Todo lo que se aplicara, en una sola transaccion
export interface PlanAplicacion {
  crear: NuevaPersona[];
  actualizar: { id: number; cedula: string; cambios: CambiosPersona; cerrarSesion: boolean }[];
  jefes: { cedula: string; cedulaJefe: string }[];
  bajas: { id: number; fechaBaja: string }[];
}

export interface DesconocidoRevision {
  nombre: string;
  filas: number;
}

export interface OpcionesImportacion {
  mapeo: MapeoColumnas;
  bajaAusentes: boolean;
}

export interface Revision {
  huella: string;
  archivo: { nombre: string; tipo: TipoArchivo; filas: number };
  columnas: ColumnaDetectada[];
  camposSinColumna: CampoImportacion[];
  erroresMapeo: string[];
  resumen: ResumenImportacion;
  filas: FilaRevisada[];
  ausentes: { cedula: string; nombre: string }[];
  desconocidos: { areas: DesconocidoRevision[]; cargos: DesconocidoRevision[] };
  avisos: string[];
  puedeAplicar: boolean;
}

export interface ResultadoAplicacion {
  creadas: number;
  actualizadas: number;
  bajas: number;
  ausentesDadosDeBaja: number;
  sinCambios: number;
}