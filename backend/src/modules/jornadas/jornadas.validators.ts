// Esquemas Zod de entrada para turnos, patrones y asignaciones de jornadas.
// Son estrictos: los datos de empresa y del usuario autenticado los establece el servidor.

import { z } from 'zod';
import { fechaIso } from '../../shared/validators/comunes';

const idPositivo = z.number().int().positive();
const nombre = z.string().trim().min(2).max(100);
const hora = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
  'La hora debe tener el formato HH:mm:ss',
);
const minutosDescanso = z.number().int().min(0);
const fecha = fechaIso;

// Calcula la duración en minutos, incluyendo turnos que terminan al día siguiente.
function duracionTurno(horaInicio: string, horaFin: string): number {
  const convertirMinutos = (valor: string): number => {
    const [horas, minutos] = valor.split(':').map(Number);
    return horas! * 60 + minutos!;
  };

  return (
    convertirMinutos(horaFin) -
    convertirMinutos(horaInicio) +
    1440
  ) % 1440;
}

const camposTurno = {
  nombre,
  horaInicio: hora,
  horaFin: hora,
  minutosDescanso,
};

export const esquemaCrearTurno = z
  .object(camposTurno)
  .strict()
  .refine(
    (datos) => duracionTurno(datos.horaInicio, datos.horaFin) > 0,
    {
      message: 'La hora de inicio y fin no pueden ser iguales',
      path: ['horaFin'],
    },
  )
  .refine(
    (datos) =>
      datos.minutosDescanso <
      duracionTurno(datos.horaInicio, datos.horaFin),
    {
      message: 'El descanso debe ser menor que la duración del turno',
      path: ['minutosDescanso'],
    },
  );

export const esquemaActualizarTurno = z
  .object({
    ...camposTurno,
    activo: z.boolean(),
  })
  .strict()
  .refine(
    (datos) => duracionTurno(datos.horaInicio, datos.horaFin) > 0,
    {
      message: 'La hora de inicio y fin no pueden ser iguales',
      path: ['horaFin'],
    },
  )
  .refine(
    (datos) =>
      datos.minutosDescanso <
      duracionTurno(datos.horaInicio, datos.horaFin),
    {
      message: 'El descanso debe ser menor que la duración del turno',
      path: ['minutosDescanso'],
    },
  );

const esquemaDiaPatron = z
  .object({
    diaCiclo: z.number().int().positive(),
    tipoDia: z.enum(['TURNO', 'DESCANSO']),
    turnoId: idPositivo.nullable(),
  })
  .strict()
  .refine(
    (dia) =>
      (dia.tipoDia === 'TURNO' && dia.turnoId !== null) ||
      (dia.tipoDia === 'DESCANSO' && dia.turnoId === null),
    {
      message: 'Los días TURNO requieren un turno y los DESCANSO no deben tenerlo',
      path: ['turnoId'],
    },
  );

const camposPatron = {
  nombre,
  descripcion: z.string().max(500).nullable(),
  cicloDias: z.number().int().min(1).max(366),
  dias: z.array(esquemaDiaPatron),
};

function validarCiclo(
  datos: { cicloDias: number; dias: Array<{ diaCiclo: number }> },
): boolean {
  if (datos.dias.length !== datos.cicloDias) {
    return false;
  }

  const posiciones = new Set(datos.dias.map((dia) => dia.diaCiclo));

  return (
    posiciones.size === datos.cicloDias &&
    datos.dias.every(
      (dia) => dia.diaCiclo >= 1 && dia.diaCiclo <= datos.cicloDias,
    )
  );
}

export const esquemaCrearPatron = z
  .object(camposPatron)
  .strict()
  .refine(validarCiclo, {
    message: 'El patrón debe contener exactamente una posición por cada día del ciclo, sin duplicados',
    path: ['dias'],
  });

export const esquemaActualizarPatron = z
  .object({
    ...camposPatron,
    activo: z.boolean(),
  })
  .strict()
  .refine(validarCiclo, {
    message: 'El patrón debe contener exactamente una posición por cada día del ciclo, sin duplicados',
    path: ['dias'],
  });

export const esquemaCrearAsignacion = z
  .object({
    usuarioId: idPositivo,
    patronId: idPositivo,
    fechaInicio: fecha,
    fechaReferencia: fecha,
  })
  .strict();

export const esquemaCerrarAsignacion = z
  .object({
    asignacionId: idPositivo,
    fechaFin: fecha,
  })
  .strict();

export const esquemaIdJornada = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const esquemaListarJornadas = z
  .object({
    incluirInactivos: z
      .enum(['true', 'false'])
      .optional()
      .transform((valor) => valor === 'true'),
  })
  .strict();

export const esquemaConsultarJornada = z
  .object({
    usuarioId: z.coerce.number().int().positive(),
    fecha,
  })
  .strict();

export type CrearTurnoEntrada = z.infer<typeof esquemaCrearTurno>;
export type ActualizarTurnoEntrada = z.infer<typeof esquemaActualizarTurno>;
export type CrearPatronEntrada = z.infer<typeof esquemaCrearPatron>;
export type ActualizarPatronEntrada = z.infer<typeof esquemaActualizarPatron>;
export type CrearAsignacionEntrada = z.infer<typeof esquemaCrearAsignacion>;
export type CerrarAsignacionEntrada = z.infer<typeof esquemaCerrarAsignacion>;
export type ListarJornadasEntrada = z.infer<typeof esquemaListarJornadas>;
export type ConsultarJornadaEntrada = z.infer<typeof esquemaConsultarJornada>;
