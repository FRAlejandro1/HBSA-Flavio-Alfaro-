// Tipos del dominio de configuracion institucional.
// Define los parametros propios de cada hospital sin depender de infraestructura.

export interface ConfiguracionInstitucional {
  plazoHoras: number;
  diasVacacionesAnuales: number;
  zonaHoraria: string;
  diasAnticipacionVacaciones: number;
}

// Datos editables por SUPERADMIN para un hospital.
export interface DatosActualizarConfiguracionInstitucional {
  plazoHoras: number;
  diasVacacionesAnuales: number;
  zonaHoraria: string;
  diasAnticipacionVacaciones: number;
}

// Contrato de persistencia de la configuracion institucional.
export interface IConfiguracionInstitucionalRepository {
  obtener: (empresaId: number) => Promise<ConfiguracionInstitucional | null>;
  actualizar: (
    empresaId: number,
    actorId: number,
    datos: DatosActualizarConfiguracionInstitucional,
  ) => Promise<ConfiguracionInstitucional>;
}