-- ============================================================
-- 009_jornadas_rotativas.sql
-- Turnos, patrones rotativos y asignaciones por empleado.
-- Cada configuración pertenece a una empresa.
-- Las asignaciones conservan su vigencia para respetar el historial.
-- ============================================================

-- Definicion de turnos reutilizables por hospital.
CREATE TABLE turnos (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT UNSIGNED NOT NULL,
  nombre              VARCHAR(100) NOT NULL,
  hora_inicio         TIME NOT NULL,
  hora_fin            TIME NOT NULL,
  minutos_descanso    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_turnos_emp_id (empresa_id, id),
  UNIQUE KEY uq_turnos_emp_nombre (empresa_id, nombre),
  CONSTRAINT fk_turnos_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT ck_turnos_horas
    CHECK (hora_inicio <> hora_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cabecera de un patron rotativo.
-- ciclo_dias indica cuantos dias componen la repeticion completa.
CREATE TABLE patrones_jornada (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT UNSIGNED NOT NULL,
  nombre              VARCHAR(100) NOT NULL,
  descripcion         VARCHAR(500) NULL,
  ciclo_dias          SMALLINT UNSIGNED NOT NULL,
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patrones_emp_id (empresa_id, id),
  UNIQUE KEY uq_patrones_emp_nombre (empresa_id, nombre),
  CONSTRAINT fk_patrones_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT ck_patrones_ciclo
    CHECK (ciclo_dias BETWEEN 1 AND 366)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada posicion del ciclo representa un turno o un descanso.
-- dia_ciclo comienza en 1 y termina en ciclo_dias.
CREATE TABLE patrones_jornada_detalle (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT UNSIGNED NOT NULL,
  patron_id           BIGINT UNSIGNED NOT NULL,
  dia_ciclo           SMALLINT UNSIGNED NOT NULL,
  tipo_dia            ENUM('TURNO','DESCANSO') NOT NULL,
  turno_id            BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patron_dia (empresa_id, patron_id, dia_ciclo),
  UNIQUE KEY uq_patron_detalle_emp_id (empresa_id, id),
  KEY ix_patron_detalle_turno (empresa_id, turno_id),
  CONSTRAINT fk_patron_detalle_patron
    FOREIGN KEY (empresa_id, patron_id)
    REFERENCES patrones_jornada (empresa_id, id),
  CONSTRAINT fk_patron_detalle_turno
    FOREIGN KEY (empresa_id, turno_id)
    REFERENCES turnos (empresa_id, id),
  CONSTRAINT ck_patron_detalle_tipo
    CHECK (
      (tipo_dia = 'TURNO' AND turno_id IS NOT NULL)
      OR
      (tipo_dia = 'DESCANSO' AND turno_id IS NULL)
    ),
  CONSTRAINT ck_patron_detalle_dia
    CHECK (dia_ciclo >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Asignacion historica del patron a un empleado.
-- fecha_referencia determina el dia 1 del ciclo.
-- fecha_fin NULL significa que la asignacion sigue vigente.
CREATE TABLE asignaciones_jornada (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT UNSIGNED NOT NULL,
  usuario_id          BIGINT UNSIGNED NOT NULL,
  patron_id           BIGINT UNSIGNED NOT NULL,
  fecha_inicio        DATE NOT NULL,
  fecha_fin            DATE NULL,
  fecha_referencia    DATE NOT NULL,
  configurado_por_id  BIGINT UNSIGNED NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asignaciones_emp_id (empresa_id, id),
  KEY ix_asignaciones_usuario_vigencia (
    empresa_id, usuario_id, fecha_inicio, fecha_fin
  ),
  KEY ix_asignaciones_patron (empresa_id, patron_id),
  CONSTRAINT fk_asignaciones_usuario
    FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_asignaciones_patron
    FOREIGN KEY (empresa_id, patron_id)
    REFERENCES patrones_jornada (empresa_id, id),
  CONSTRAINT fk_asignaciones_configurador
    FOREIGN KEY (empresa_id, configurado_por_id)
    REFERENCES usuarios (empresa_id, id),
  CONSTRAINT ck_asignaciones_fechas
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;