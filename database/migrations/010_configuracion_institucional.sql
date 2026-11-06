-- Configuracion institucional independiente por hospital.
-- Amplia los parametros que SUPERADMIN puede administrar desde la interfaz.

ALTER TABLE config_aprobacion
  DROP CHECK ck_cfgapr_plazo,
  MODIFY COLUMN plazo_horas DECIMAL(5,2) NOT NULL DEFAULT 48.00,
  ADD COLUMN dias_vacaciones_anuales DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Guayaquil',
  ADD COLUMN dias_anticipacion_vacaciones SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  ADD CONSTRAINT ck_cfgapr_plazo CHECK (plazo_horas > 0),
  ADD CONSTRAINT ck_cfgapr_dias_vac CHECK (dias_vacaciones_anuales > 0);