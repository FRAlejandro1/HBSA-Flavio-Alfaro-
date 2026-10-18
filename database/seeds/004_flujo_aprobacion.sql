-- ============================================================
-- 004_flujo_aprobacion.sql
-- Parametros y rutas del flujo de aprobacion de vacaciones del hospital.
-- Se ejecuta una sola vez por hospital; las rutas se pueden cambiar despues sin tocar codigo.
-- ============================================================
SET NAMES utf8mb4;

-- Hospital al que se cargan los parametros (nombre tal como esta en empresas.nombre)
SET @hospital = 'Hospital Básico San Andrés';
SET @empresa_id = (SELECT id FROM empresas WHERE nombre = @hospital);

-- Horas que tiene un aprobador para responder antes de que Talento Humano pueda escalar la solicitud.
-- Solo crea la configuracion si aun no existe; conserva cualquier plazo personalizado.
INSERT INTO config_aprobacion (empresa_id, plazo_horas)
SELECT @empresa_id, 48
WHERE @empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM config_aprobacion existente
    WHERE existente.empresa_id = @empresa_id
  );

-- Quien aprueba segun el nivel del solicitante (cargos.nivel_jerarquico), en un solo paso:
--   5 operativo, 4 coordinacion o supervision y 3 jefe de area: su jefe inmediato
--   2 subdirector: la maxima autoridad (el Director)
--   1 director: ruta especial, la decide el SUPERADMIN
-- Solo inserta rutas ausentes; conserva rutas existentes, incluso si fueron personalizadas.
INSERT INTO rutas_aprobacion (empresa_id, nivel_solicitante, orden, tipo_aprobador)
SELECT @empresa_id, catalogo.nivel_solicitante, catalogo.orden, catalogo.tipo_aprobador
FROM (
  SELECT 5 AS nivel_solicitante, 1 AS orden, 'JEFE_INMEDIATO' AS tipo_aprobador
  UNION ALL SELECT 4, 1, 'JEFE_INMEDIATO'
  UNION ALL SELECT 3, 1, 'JEFE_INMEDIATO'
  UNION ALL SELECT 2, 1, 'AUTORIDAD_MAXIMA'
  UNION ALL SELECT 1, 1, 'SUPERADMIN'
) AS catalogo
WHERE @empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rutas_aprobacion existente
    WHERE existente.empresa_id = @empresa_id
      AND existente.nivel_solicitante = catalogo.nivel_solicitante
      AND existente.orden = catalogo.orden
  );

-- Verificacion: en una instalacion inicial deben salir 1 parametro y 5 rutas.
SELECT (SELECT COUNT(*) FROM config_aprobacion WHERE empresa_id = @empresa_id) AS parametros,
       (SELECT COUNT(*) FROM rutas_aprobacion WHERE empresa_id = @empresa_id) AS rutas;
