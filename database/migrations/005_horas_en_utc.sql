-- ============================================================
-- 005_horas_en_utc.sql
-- Los instantes (fecha y hora de un hecho) se guardan en UTC; las fechas de calendario
-- (inicio de vacaciones, ingreso, baja) son fechas sin hora y no cambian.
-- La solicitud guarda ademas su fecha de calendario en la zona del negocio, calculada por el backend:
-- de ella se deriva si la solicitud es programada, asi la regla no depende de la hora UTC.
-- ============================================================

-- La sesion de esta migracion trabaja en UTC
SET time_zone = '+00:00';

-- Se quita la columna derivada, que dependia de la hora local, y se agrega la fecha de calendario
ALTER TABLE solicitudes_vacaciones
  DROP COLUMN tipo,
  ADD COLUMN fecha_solicitud DATE NULL AFTER solicitado_at;

-- Los datos existentes estaban en hora de Ecuador (-05:00): se toma su fecha y los instantes pasan a UTC
UPDATE solicitudes_vacaciones
SET fecha_solicitud = DATE(solicitado_at),
    solicitado_at = CONVERT_TZ(solicitado_at, '-05:00', '+00:00'),
    visto_bueno_at = CONVERT_TZ(visto_bueno_at, '-05:00', '+00:00'),
    fecha_resolucion = CONVERT_TZ(fecha_resolucion, '-05:00', '+00:00');

-- Se vuelve a crear la columna derivada, ahora a partir de la fecha de calendario de la solicitud
ALTER TABLE solicitudes_vacaciones
  MODIFY COLUMN fecha_solicitud DATE NOT NULL,
  -- Programada si hay >= 7 dias entre la fecha de la solicitud y el inicio de las vacaciones
  ADD COLUMN tipo ENUM('PROGRAMADA','NO_PROGRAMADA') GENERATED ALWAYS AS (
    CASE WHEN DATEDIFF(fecha_inicio, fecha_solicitud) >= 7 THEN 'PROGRAMADA' ELSE 'NO_PROGRAMADA' END
  ) STORED AFTER fecha_solicitud;

-- Instantes de permisos por hora y de envio de PDF: de hora de Ecuador a UTC
UPDATE permisos_hora
SET solicitado_at = CONVERT_TZ(solicitado_at, '-05:00', '+00:00'),
    fecha_resolucion = CONVERT_TZ(fecha_resolucion, '-05:00', '+00:00');

UPDATE documentos_pdf
SET enviado_th_at = CONVERT_TZ(enviado_th_at, '-05:00', '+00:00');