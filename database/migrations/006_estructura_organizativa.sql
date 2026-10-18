-- ============================================================
-- 006_estructura_organizativa.sql
-- Clasificacion por procesos del MSP, areas con subareas (arbol) y datos del puesto.
-- Las columnas nuevas son opcionales o con valor por defecto para no romper lo que ya inserta el backend.
-- ============================================================

-- Procesos institucionales: clasificacion fija de la estructura del MSP (catalogo global, NO es tenant)
CREATE TABLE procesos (
  id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo  VARCHAR(30)  NOT NULL,   -- GOBERNANTE, AGREGADOR_VALOR, HABILITANTE_ASESORIA, HABILITANTE_APOYO
  detalle VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_procesos_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO procesos (codigo, detalle) VALUES
  ('GOBERNANTE',           'Proceso gobernante: direccionamiento y conduccion estrategica'),
  ('AGREGADOR_VALOR',      'Procesos agregadores de valor'),
  ('HABILITANTE_ASESORIA', 'Procesos habilitantes de asesoria'),
  ('HABILITANTE_APOYO',    'Procesos habilitantes de apoyo');

-- Areas en arbol: una subarea es un area con parent_id (ej. Laboratorio dentro de Apoyo Diagnostico y Terapeutico)
-- proceso_id lo lleva el area raiz y las subareas lo heredan (el service lo exige; aqui es opcional)
-- Que un area no sea su propio padre ni forme ciclos lo valida el service: un CHECK no admite columnas AUTO_INCREMENT
ALTER TABLE areas
  ADD COLUMN proceso_id TINYINT UNSIGNED NULL AFTER empresa_id,
  ADD COLUMN parent_id  BIGINT UNSIGNED NULL AFTER proceso_id,
  ADD KEY ix_areas_proceso (proceso_id),
  -- Arbol de un hospital: hijos de un area
  ADD KEY ix_areas_parent (empresa_id, parent_id),
  ADD CONSTRAINT fk_areas_proceso FOREIGN KEY (proceso_id) REFERENCES procesos (id),
  ADD CONSTRAINT fk_areas_parent  FOREIGN KEY (empresa_id, parent_id) REFERENCES areas (empresa_id, id);

-- Datos del puesto segun el PDF del MSP; el nombre con grado (ej. Enfermero/a 3) sigue yendo en detalle
-- nivel_jerarquico: 1 maxima autoridad, 2 subdireccion, 3 jefatura de area o gestion, 4 jefatura de subarea o coordinacion, 5 operativo
ALTER TABLE cargos
  ADD COLUMN grado            TINYINT UNSIGNED NULL AFTER detalle,      -- 1 al 6; null si el puesto no tiene grado
  ADD COLUMN rol_puesto       VARCHAR(60) NULL AFTER grado,             -- ej. Ejecucion y Supervision de Procesos
  ADD COLUMN nivel_jerarquico TINYINT UNSIGNED NOT NULL DEFAULT 5 AFTER rol_puesto,
  -- Buscar la maxima autoridad del hospital al escalar una solicitud
  ADD KEY ix_cargos_nivel (empresa_id, nivel_jerarquico),
  ADD CONSTRAINT ck_cargos_grado CHECK (grado IS NULL OR grado BETWEEN 1 AND 6),
  ADD CONSTRAINT ck_cargos_nivel CHECK (nivel_jerarquico BETWEEN 1 AND 5);