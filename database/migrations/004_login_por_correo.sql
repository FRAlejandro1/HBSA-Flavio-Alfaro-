-- ============================================================
-- 004_login_por_correo.sql
-- Correo unico en todo el sistema (el hospital sale del usuario),
-- ingreso opcional (el personal importado no necesita cuenta) y fecha de baja.
-- ============================================================

ALTER TABLE usuarios
  -- El unico por hospital se reemplaza por uno global (se aplica antes de cargar datos reales)
  DROP INDEX uq_usuarios_emp_email,
  -- Correo y clave opcionales: quien no inicia sesion no los necesita
  MODIFY COLUMN email VARCHAR(150) NULL,
  MODIFY COLUMN password_hash VARCHAR(255) NULL,
  -- Varios NULL son validos en un indice unico; la comparacion no distingue mayusculas
  ADD UNIQUE KEY uq_usuarios_email (email),
  -- Fecha en que el servidor sale de la plantilla (estado INACTIVO)
  ADD COLUMN fecha_baja DATE NULL AFTER estado,
  -- Una clave sin correo no permite iniciar sesion: la BD lo impide
  ADD CONSTRAINT ck_usuarios_ingreso CHECK (password_hash IS NULL OR email IS NOT NULL);