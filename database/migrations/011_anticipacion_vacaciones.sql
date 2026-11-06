-- Conserva el umbral de anticipacion aplicado a cada solicitud de vacaciones.
-- Las solicitudes historicas mantienen el criterio anterior de siete dias.
-- Las nuevas solicitudes almacenaran el valor institucional vigente al crearse.

ALTER TABLE solicitudes_vacaciones
  ADD COLUMN dias_anticipacion_aplicada SMALLINT UNSIGNED NOT NULL DEFAULT 7
  AFTER fecha_solicitud;

-- El tipo de solicitud se calcula con el umbral guardado en cada registro.
-- Los cambios posteriores de configuracion no modifican solicitudes anteriores.

ALTER TABLE solicitudes_vacaciones
  MODIFY COLUMN tipo ENUM('PROGRAMADA', 'NO_PROGRAMADA')
  GENERATED ALWAYS AS (
    CASE
      WHEN DATEDIFF(fecha_inicio, fecha_solicitud) >= dias_anticipacion_aplicada
        THEN 'PROGRAMADA'
      ELSE 'NO_PROGRAMADA'
    END
  ) STORED;