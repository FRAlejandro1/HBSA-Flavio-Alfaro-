// Contratos de autenticación alineados con auth.dominio.ts del backend.
export interface UsuarioAutenticado {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string | null;
  rol: 'SUPERADMIN' | 'TALENTO_HUMANO' | 'JEFE_AREA' | 'EMPLEADO';
  empresa: { id: number; nombre: string };
  area: { id: number; detalle: string };
  cargo: { id: number; detalle: string };
}

export interface RespuestaLogin {
  accessToken: string;
  expiraEn: number;
  usuario: UsuarioAutenticado;
}

export interface RespuestaSesion {
  usuario: UsuarioAutenticado;
}

export interface RespuestaRefresco {
  accessToken: string;
  expiraEn: number;
}
