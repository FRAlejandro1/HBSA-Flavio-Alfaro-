-- ============================================================
-- 001_esquema_inicial.sql (v2)
-- Esquema base del sistema de vacaciones hospitalarias.
-- Multiempresa: cada "empresa" es un HOSPITAL, que filtra sus propios datos.
-- Motor InnoDB, utf8mb4, MySQL 8.0 (ultima). Toda tabla de negocio lleva empresa_id.
-- ============================================================
SET NAMES utf8mb4;
SET time_zone = '-05:00'; -- hora de Ecuador continental

-- Direcciones provinciales / zonas: catalogo global (NO es tenant). Ej. Zona 4
CREATE TABLE direcciones_provinciales (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  detalle     VARCHAR(150) NOT NULL, -- ej. Coordinacion Zonal 4 de Salud Manabi - Santo Domingo de los Tsachilas
  zona        VARCHAR(30)  NOT NULL, -- ej. Zona 4
  PRIMARY KEY (id),
  UNIQUE KEY uq_dirprov_detalle (detalle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Empresas = hospitales: raiz del aislamiento multitenant; la direccion provincial sale de aqui
CREATE TABLE empresas (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  direccion_provincial_id  BIGINT UNSIGNED NOT NULL,
  nombre                   VARCHAR(150) NOT NULL, -- ej. Hospital Basico San Andres
  lugar                    VARCHAR(150) NOT NULL, -- ej. Flavio Alfaro, se imprime en la solicitud
  estado                   ENUM('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_empresas_nombre (nombre),
  KEY ix_empresas_dirprov (direccion_provincial_id),
  CONSTRAINT fk_empresas_dirprov FOREIGN KEY (direccion_provincial_id) REFERENCES direcciones_provinciales (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Roles del sistema (catalogo global)
CREATE TABLE roles (
  id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo  VARCHAR(30) NOT NULL,   -- SUPERADMIN, TALENTO_HUMANO, JEFE_AREA, EMPLEADO
  detalle VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cargos: concentra responsabilidad y funciones que se imprimen en la solicitud
CREATE TABLE cargos (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id      BIGINT UNSIGNED NOT NULL,
  detalle         VARCHAR(150) NOT NULL,
  responsabilidad TEXT NOT NULL,
  funciones       TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargos_emp_id (empresa_id, id),
  UNIQUE KEY uq_cargos_emp_detalle (empresa_id, detalle),
  CONSTRAINT fk_cargos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Areas / unidades del hospital (el jefe se asigna despues para evitar dependencia circular)
CREATE TABLE areas (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id  BIGINT UNSIGNED NOT NULL,
  detalle     VARCHAR(150) NOT NULL,
  jefe_id     BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_areas_emp_id (empresa_id, id),
  UNIQUE KEY uq_areas_emp_detalle (empresa_id, detalle),
  CONSTRAINT fk_areas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios: datos personales, rol, cargo, jefe inmediato y jti del refresh token vigente
CREATE TABLE usuarios (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT UNSIGNED NOT NULL,
  area_id           BIGINT UNSIGNED NOT NULL,
  cargo_id          BIGINT UNSIGNED NOT NULL,
  rol_id            TINYINT UNSIGNED NOT NULL,
  jefe_inmediato_id BIGINT UNSIGNED NULL,
  cedula            VARCHAR(20)  NOT NULL,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  telefono          VARCHAR(20)  NULL,     -- telefono de localizacion que pide el formulario
  password_hash     VARCHAR(255) NOT NULL,
  fecha_ingreso     DATE NOT NULL,         -- base para generar periodos de vacaciones
  token_id          CHAR(36) NULL,         -- jti del refresh token activo (revocacion)
  estado            ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_emp_id (empresa_id, id),
  UNIQUE KEY uq_usuarios_emp_cedula (empresa_id, cedula),
  UNIQUE KEY uq_usuarios_emp_email (empresa_id, email),
  -- Listados por area y autocompletado del buscador (consulta de alto uso)
  KEY ix_usuarios_area_estado (empresa_id, area_id, estado),
  KEY ix_usuarios_busqueda (empresa_id, apellidos, nombres),
  CONSTRAINT fk_usuarios_area  FOREIGN KEY (empresa_id, area_id)  REFERENCES areas (empresa_id, id),
  CONSTRAINT fk_usuarios_cargo FOREIGN KEY (empresa_id, cargo_id) REFERENCES cargos (empresa_id, id),
  CONSTRAINT fk_usuarios_rol   FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT fk_usuarios_jefe  FOREIGN KEY (empresa_id, jefe_inmediato_id) REFERENCES usuarios (empresa_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cierra la dependencia circular: el jefe del area es un usuario de la misma empresa
ALTER TABLE areas
  ADD CONSTRAINT fk_areas_jefe FOREIGN KEY (empresa_id, jefe_id) REFERENCES usuarios (empresa_id, id);

-- Feriados nacionales/locales: el backend los excluye al contar dias laborables
CREATE TABLE feriados (
  fecha   DATE NOT NULL,
  detalle VARCHAR(100) NOT NULL,
  PRIMARY KEY (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Periodos de vacaciones: un registro por usuario y anio de servicio (30 dias laborables)
CREATE TABLE periodos_vacaciones (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id      BIGINT UNSIGNED NOT NULL,
  usuario_id      BIGINT UNSIGNED NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_caducidad DATE NOT NULL,          -- maximo 2 anios desde fecha_inicio
  dias_derecho    DECIMAL(5,2) NOT NULL,  -- 30 laborables, lo fija el backend por configuracion
  dias_usados     DECIMAL(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_periodo_usuario_inicio (empresa_id, usuario_id, fecha_inicio),
  -- FIFO: periodos mas antiguos con saldo, por usuario
  KEY ix_periodos_fifo (empresa_id, usuario_id, fecha_caducidad),
  CONSTRAINT fk_periodos_usuario FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT ck_periodos_dias CHECK (dias_usados >= 0 AND dias_usados <= dias_derecho),
  CONSTRAINT ck_periodos_caducidad CHECK (fecha_caducidad > fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contador atomico del orden de tramite por empresa y anio
CREATE TABLE secuencias_tramite (
  empresa_id BIGINT UNSIGNED NOT NULL,
  anio       SMALLINT UNSIGNED NOT NULL,
  ultimo     INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, anio),
  CONSTRAINT fk_seq_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Solicitudes de vacaciones (snapshot de cargo/area/saldos para trazabilidad del PDF)
CREATE TABLE solicitudes_vacaciones (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT UNSIGNED NOT NULL,
  orden_tramite     VARCHAR(30) NOT NULL,   -- ej. VAC-2026-000123
  usuario_id        BIGINT UNSIGNED NOT NULL,
  area_id           BIGINT UNSIGNED NOT NULL,
  cargo_id          BIGINT UNSIGNED NOT NULL,
  lugar             VARCHAR(150) NOT NULL,  -- lugar de la solicitud, tomado de la empresa
  telefono_localizacion VARCHAR(20) NULL,
  solicitado_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- fecha y hora del sistema
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NOT NULL,
  dias_solicitados  DECIMAL(5,2) NOT NULL,  -- dias laborables, calculados por el backend
  -- Programada si hay >= 7 dias de anticipacion; la BD lo deriva, nadie lo escribe
  tipo ENUM('PROGRAMADA','NO_PROGRAMADA') GENERATED ALWAYS AS (
    CASE WHEN DATEDIFF(fecha_inicio, DATE(solicitado_at)) >= 7 THEN 'PROGRAMADA' ELSE 'NO_PROGRAMADA' END
  ) STORED,
  estado            ENUM('PENDIENTE','AUTORIZADA','NEGADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  visto_bueno_por_id BIGINT UNSIGNED NULL,  -- jefe inmediato (seccion 3 del formulario)
  visto_bueno_at    DATETIME NULL,
  resuelto_por_id   BIGINT UNSIGNED NULL,   -- jefe de area que autoriza, niega o cancela (seccion 4)
  fecha_resolucion  DATETIME NULL,
  motivo_resolucion VARCHAR(500) NULL,      -- obligatorio al negar (lo exige el service)
  dias_tomados_previos     DECIMAL(5,2) NULL, -- snapshot para el bloque de Talento Humano
  dias_disponibles_previos DECIMAL(5,2) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sol_emp_id (empresa_id, id),
  UNIQUE KEY uq_sol_emp_tramite (empresa_id, orden_tramite),
  -- Historial del empleado filtrado por estado y fecha
  KEY ix_sol_usuario (empresa_id, usuario_id, estado, fecha_inicio),
  -- Bandeja del jefe: pendientes de su area ordenadas por fecha
  KEY ix_sol_bandeja (empresa_id, area_id, estado, solicitado_at),
  CONSTRAINT fk_sol_usuario  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_sol_area     FOREIGN KEY (empresa_id, area_id)    REFERENCES areas (empresa_id, id),
  CONSTRAINT fk_sol_cargo    FOREIGN KEY (empresa_id, cargo_id)   REFERENCES cargos (empresa_id, id),
  CONSTRAINT fk_sol_vb       FOREIGN KEY (empresa_id, visto_bueno_por_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_sol_resuelve FOREIGN KEY (empresa_id, resuelto_por_id)    REFERENCES usuarios (empresa_id, id),
  CONSTRAINT ck_sol_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT ck_sol_dias CHECK (dias_solicitados > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Detalle del descuento FIFO: de que periodo salio cada dia solicitado
CREATE TABLE solicitud_descuentos (
  solicitud_id BIGINT UNSIGNED NOT NULL,
  periodo_id   BIGINT UNSIGNED NOT NULL,
  dias         DECIMAL(5,2) NOT NULL,
  PRIMARY KEY (solicitud_id, periodo_id),
  CONSTRAINT fk_desc_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_vacaciones (id),
  CONSTRAINT fk_desc_periodo   FOREIGN KEY (periodo_id)   REFERENCES periodos_vacaciones (id),
  CONSTRAINT ck_desc_dias CHECK (dias > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permisos por hora: replica el formulario de control de salida del personal
CREATE TABLE permisos_hora (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT UNSIGNED NOT NULL,
  orden_tramite       VARCHAR(30) NOT NULL,
  usuario_id          BIGINT UNSIGNED NOT NULL,
  area_id             BIGINT UNSIGNED NOT NULL,
  jefe_inmediato_id   BIGINT UNSIGNED NULL,       -- snapshot del jefe al solicitar
  fecha               DATE NOT NULL,
  motivo              ENUM('ASUNTOS_OFICIALES','ASUNTOS_PERSONALES','ENFERMEDAD','OTROS') NOT NULL,
  detalle_asunto      VARCHAR(500) NULL,          -- ej. zimbra o quipux, EODS o centro de salud a supervisar
  observaciones       VARCHAR(500) NULL,
  hora_salida         TIME NOT NULL,
  hora_regreso        TIME NOT NULL,
  -- Tiempo autorizado en minutos, derivado de las horas
  tiempo_minutos      SMALLINT UNSIGNED GENERATED ALWAYS AS (TIME_TO_SEC(TIMEDIFF(hora_regreso, hora_salida)) DIV 60) STORED,
  estado              ENUM('PENDIENTE','AUTORIZADO','NEGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  autorizado_por_id   BIGINT UNSIGNED NULL,       -- jefe inmediato
  supervisor_id       BIGINT UNSIGNED NULL,       -- autoridad que se supervisa (firma opcional)
  fecha_resolucion    DATETIME NULL,
  solicitado_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_perm_emp_tramite (empresa_id, orden_tramite),
  -- Historial por servidor y bandeja del jefe
  KEY ix_perm_usuario (empresa_id, usuario_id, fecha),
  KEY ix_perm_bandeja (empresa_id, jefe_inmediato_id, estado, solicitado_at),
  CONSTRAINT fk_perm_usuario FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_perm_area    FOREIGN KEY (empresa_id, area_id)    REFERENCES areas (empresa_id, id),
  CONSTRAINT fk_perm_jefe    FOREIGN KEY (empresa_id, jefe_inmediato_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_perm_autoriza FOREIGN KEY (empresa_id, autorizado_por_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT fk_perm_supervisor FOREIGN KEY (empresa_id, supervisor_id) REFERENCES usuarios (empresa_id, id),
  CONSTRAINT ck_perm_horas CHECK (hora_regreso > hora_salida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notificaciones al solicitante (aprobado, negado, cancelado)
CREATE TABLE notificaciones (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id    BIGINT UNSIGNED NOT NULL,
  usuario_id    BIGINT UNSIGNED NOT NULL,
  tipo          VARCHAR(40) NOT NULL,
  referencia_id BIGINT UNSIGNED NULL,
  mensaje       VARCHAR(300) NOT NULL,
  leida         TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Campana de notificaciones: no leidas del usuario, mas recientes primero
  KEY ix_notif_usuario (empresa_id, usuario_id, leida, created_at),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PDFs generados y su envio a Talento Humano (hash para integridad)
CREATE TABLE documentos_pdf (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id    BIGINT UNSIGNED NOT NULL,
  solicitud_id  BIGINT UNSIGNED NOT NULL,
  ruta          VARCHAR(300) NOT NULL,
  sha256        CHAR(64) NOT NULL,
  enviado_th_at DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pdf_solicitud (empresa_id, solicitud_id),
  CONSTRAINT fk_pdf_solicitud FOREIGN KEY (empresa_id, solicitud_id) REFERENCES solicitudes_vacaciones (empresa_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bitacora de auditoria (solo insercion)
CREATE TABLE audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id  BIGINT UNSIGNED NOT NULL,
  usuario_id  BIGINT UNSIGNED NULL,
  accion      VARCHAR(60) NOT NULL,
  entidad     VARCHAR(60) NOT NULL,
  entidad_id  BIGINT UNSIGNED NULL,
  detalle     JSON NULL,
  ip          VARCHAR(45) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Trazabilidad de una entidad concreta en el tiempo
  KEY ix_audit_entidad (empresa_id, entidad, entidad_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;