-- ============================================================
-- 008_dias_vacaciones.sql
-- Dias de vacaciones por periodo, configurables por area y por persona.
-- Manda el valor de la persona; si no tiene, el de su area; si el area no tiene, el de su area padre;
-- y si ninguna tiene, el valor por defecto del backend (DIAS_VACACIONES_ANUALES).
-- Solo afecta a los periodos que se creen despues: los que ya existen no cambian.
-- ============================================================

ALTER TABLE areas
  ADD COLUMN dias_vacaciones DECIMAL(5,2) NULL AFTER jefe_id,
  ADD CONSTRAINT ck_areas_dias_vacaciones CHECK (dias_vacaciones IS NULL OR dias_vacaciones > 0);

ALTER TABLE usuarios
  ADD COLUMN dias_vacaciones DECIMAL(5,2) NULL AFTER fecha_ingreso,
  ADD CONSTRAINT ck_usuarios_dias_vacaciones CHECK (dias_vacaciones IS NULL OR dias_vacaciones > 0);
