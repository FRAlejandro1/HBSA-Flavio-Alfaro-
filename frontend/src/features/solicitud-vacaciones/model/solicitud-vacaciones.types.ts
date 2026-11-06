// Datos que el formulario envía al crear una solicitud de vacaciones.
export interface DatosSolicitudVacaciones {
  fechaInicio: string;
  fechaFin: string;
  telefonoLocalizacion?: string | undefined;
  justificacion?: string | undefined;
}