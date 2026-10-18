-- ============================================================
-- 007_flujo_aprobacion.sql
-- Flujo de aprobacion configurable de vacaciones: rutas por nivel, pasos con trazabilidad,
-- escalamiento y delegacion. Los instantes van en UTC, igual que en 005.
-- Las columnas visto_bueno_* y resuelto_* de solicitudes_vacaciones se mantienen como snapshot del PDF.
-- ============================================================

-- Parametros del flujo por hospital
CREATE TABLE config_aprobacion (
  empresa_id  BIGINT UNSIGNED NOT NULL,
  plazo_horas SMALLINT UNSIGNED NOT NULL DEFAULT 48, -- horas para responder antes de alertar o escalar (valor provisional)
  PRIMARY KEY (empresa_id),
  CONSTRAINT fk_cfgapr_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT ck_cfgapr_plazo CHECK (plazo_horas > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ruta de aprobacion segun el nivel jerarquico del solicitante: un registro por paso, en orden
CREATE TABLE rutas_aprobacion (
  empresa_id        BIGINT UNSIGNED NOT NULL,
  nivel_solicitante TINYINT UNSIGNED NOT NULL,  -- cargos.nivel_jerarquico de quien solicita
  orden             TINYINT UNSIGNED NOT NULL,  -- 1 es el primer paso
  tipo_aprobador    ENUM('JEFE_INMEDIATO','JEFE_AREA','AUTORIDAD_MAXIMA','SUPERADMIN') NOT NULL,
  PRIMARY KEY (empresa_id, nivel_solicitante, orden),
  CONSTRAINT fk_rutas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT ck_rutas_nivel CHECK (nivel_solicitante BETWEEN 1 AND 5),
  CONSTRAINT ck_rutas_orden CHECK (orden >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Delegaciones: un usuario autoriza a otro a aprobar por el durante un periodo
CREATE TABLE delegaciones (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id     BIGINT UNSIGNED NOT NULL,
  delegante_id   BIGINT UNSIGNED NOT NULL,
  delegado_id    BIGINT UNSIGNED NOT NULL,
  vigente_desde  DATETIME NOT NULL,             -- UTC
  vigente_hasta  DATETIME NOT NULL,             -- UTC
  creada_por_id  BIGINT UNSIGNED NOT NULL,      -- quien la registro (el propio delegante o Talento Humano)
  motivo         VARCHAR(300) NULL,
  revocada_at    DATETIME NULL,                 -- UTC; si tiene valor, la delegacion ya no vale
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deleg_emp_id (empresa_id, id),
  -- Delegaciones vigentes de quien intenta aprobar (control de permisos)
  KEY ix_deleg_delegado (empresa_id, delegado_id, vigente_desde, vigente_hasta),
  KEY ix_deleg_delegante (empresa_id, delegante_id, vigente_desde, vigente_hasta),
  CONSTRAINT fk_deleg_delegante FOREIGN KEY (empresa_id, delegante_id)  REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_deleg_delegado  FOREIGN KEY (empresa_id, delegado_id)   REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_deleg_creada    FOREIGN KEY (empresa_id, creada_por_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT ck_deleg_periodo CHECK (vigente_hasta > vigente_desde),
  CONSTRAINT ck_deleg_distintos CHECK (delegante_id <> delegado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pasos de aprobacion de cada solicitud: quien debia aprobar, quien decidio, cuando y por que
-- Un escalamiento no edita el paso: lo marca ESCALADO y crea otro paso asignado al nuevo responsable
CREATE TABLE solicitud_aprobaciones (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT UNSIGNED NOT NULL,
  solicitud_id      BIGINT UNSIGNED NOT NULL,
  orden             TINYINT UNSIGNED NOT NULL,  -- paso de la ruta al que pertenece
  tipo_aprobador    ENUM('JEFE_INMEDIATO','JEFE_AREA','AUTORIDAD_MAXIMA','SUPERADMIN') NOT NULL,
  origen            ENUM('RUTA','ESCALAMIENTO_MANUAL','ESCALAMIENTO_PLAZO') NOT NULL DEFAULT 'RUTA',
  aprobador_id      BIGINT UNSIGNED NOT NULL,   -- responsable asignado al crear el paso (no cambia si despues cambia el jefe)
  estado            ENUM('PENDIENTE','APROBADO','NEGADO','ESCALADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  decidido_por_id   BIGINT UNSIGNED NULL,       -- quien decidio de verdad: el asignado, un delegado o quien escalo
  delegacion_id     BIGINT UNSIGNED NULL,       -- delegacion que dio la atribucion, si la decision fue por delegacion
  escalada_desde_id BIGINT UNSIGNED NULL,       -- paso anterior del que viene este por escalamiento
  motivo            VARCHAR(500) NULL,          -- obligatorio al negar o escalar (lo exige el service)
  asignado_at       DATETIME NOT NULL,          -- UTC, lo escribe el backend
  vence_at          DATETIME NULL,              -- UTC, limite para responder (config_aprobacion.plazo_horas)
  decidido_at       DATETIME NULL,              -- UTC
  -- 1 mientras el paso esta pendiente y NULL despues: el unico de abajo impide dos pasos pendientes a la vez
  pendiente_unica   TINYINT GENERATED ALWAYS AS (CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_apr_emp_id (empresa_id, id),
  UNIQUE KEY uq_apr_pendiente (empresa_id, solicitud_id, pendiente_unica),
  -- Historial de una solicitud en orden
  KEY ix_apr_solicitud (empresa_id, solicitud_id, orden, id),
  -- Bandeja del aprobador: pasos pendientes por vencimiento
  KEY ix_apr_bandeja (empresa_id, aprobador_id, estado, vence_at),
  -- Barrido de pasos vencidos si Redis pierde el temporizador
  KEY ix_apr_vencimiento (empresa_id, estado, vence_at),
  CONSTRAINT fk_apr_solicitud  FOREIGN KEY (empresa_id, solicitud_id)      REFERENCES solicitudes_vacaciones (empresa_id, id),
  CONSTRAINT fk_apr_aprobador  FOREIGN KEY (empresa_id, aprobador_id)      REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_apr_decidido   FOREIGN KEY (empresa_id, decidido_por_id)   REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_apr_delegacion FOREIGN KEY (empresa_id, delegacion_id)     REFERENCES delegaciones (empresa_id, id),
  CONSTRAINT fk_apr_escalada   FOREIGN KEY (empresa_id, escalada_desde_id) REFERENCES solicitud_aprobaciones (empresa_id, id),
  CONSTRAINT ck_apr_orden CHECK (orden >= 1),
  -- Un paso pendiente no tiene decision; uno resuelto siempre la tiene
  CONSTRAINT ck_apr_decision CHECK (
    (estado = 'PENDIENTE' AND decidido_at IS NULL) OR (estado <> 'PENDIENTE' AND decidido_at IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;