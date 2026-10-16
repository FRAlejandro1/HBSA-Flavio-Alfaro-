-- ============================================================
-- 003_ajustes_v3.sql
-- Zonas como tabla propia, paso de visto bueno y justificacion.
-- Se aplica sobre 001 antes de cargar datos reales.
-- ============================================================

-- Zonas: nivel mas alto de la jerarquia (ej. Zona 4)
CREATE TABLE zonas (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  detalle VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_zonas_detalle (detalle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada direccion provincial pertenece a una zona; se reemplaza la columna de texto
ALTER TABLE direcciones_provinciales
  DROP COLUMN zona,
  ADD COLUMN zona_id BIGINT UNSIGNED NOT NULL AFTER id,
  ADD KEY ix_dirprov_zona (zona_id),
  ADD CONSTRAINT fk_dirprov_zona FOREIGN KEY (zona_id) REFERENCES zonas (id);

-- Estado intermedio: el jefe inmediato ya dio su visto bueno
ALTER TABLE solicitudes_vacaciones
  MODIFY COLUMN estado ENUM('PENDIENTE','VISTO_BUENO','AUTORIZADA','NEGADA','CANCELADA')
    NOT NULL DEFAULT 'PENDIENTE',
  -- Justificacion del solicitante, obligatoria en NO_PROGRAMADA (regla en el service)
  ADD COLUMN justificacion VARCHAR(500) NULL AFTER fecha_fin;