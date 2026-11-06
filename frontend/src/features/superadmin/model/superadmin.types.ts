// Días de vacaciones por período, según el contrato de configuración del servidor.
export type OrigenDias = 'PROPIO' | 'HEREDADO' | 'PREDETERMINADO';

export interface ConfiguracionDias {
  diasVacaciones: number | null;
  diasEfectivos: number;
  origen: OrigenDias;
}

export interface RespuestaConfiguracionDias {
  configuracion: ConfiguracionDias;
}

export type ObjetivoDias = 'areas' | 'usuarios';

// Secciones de la administración del SUPERADMIN.
export type IdSeccionAdmin =
  | 'cuentas'
  | 'roles'
  | 'estructura'
  | 'dias'
  | 'revertir';

export interface CampoAdmin {
  id: string;
  etiqueta: string;
  tipo: 'texto' | 'seleccion' | 'textarea';
  opciones?: readonly string[] | undefined;
  requerido?: boolean | undefined;
  ayuda?: string | undefined;
}

// Lo que se ve en una pantalla que todavía no está conectada al servidor.
export interface DetalleSeccionAdmin {
  buscador?: string | undefined;
  filtros?: readonly CampoAdmin[] | undefined;
  acciones?: readonly string[] | undefined;
  formulario?:
    | {
        titulo: string;
        campos: readonly CampoAdmin[];
        accion: string;
      }
    | undefined;
  formularioPrimero?: boolean | undefined;
  tituloTabla?: string | undefined;
  columnas?: readonly string[] | undefined;
}

export interface SeccionAdmin {
  id: IdSeccionAdmin;
  titulo: string;
  descripcion: string;
  icono: string;
  // Las conectadas tienen su propio componente; las demás se dibujan con el detalle
  conectada: boolean;
  detalle?: DetalleSeccionAdmin | undefined;
}