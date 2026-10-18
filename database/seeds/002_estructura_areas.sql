-- ============================================================
-- 002_estructura_areas.sql
-- Estructura organizativa del hospital segun el PDF "Estructura de puestos de hospitales basicos
-- de 30 camas o mas del MSP": areas principales por proceso y sus subareas.
-- Se corre una sola vez por hospital, despues de 001_roles.sql y de las migraciones 001-007.
-- ============================================================
SET NAMES utf8mb4;

-- Hospital al que se carga la estructura (nombre tal como esta en empresas.nombre)
SET @hospital = 'Hospital Básico San Andrés';
SET @empresa_id = (SELECT id FROM empresas WHERE nombre = @hospital);

-- Areas principales: el INSERT falla si el hospital no existe (empresa_id NULL), asi no queda nada a medias
INSERT INTO areas (empresa_id, proceso_id, detalle)
SELECT hospital.empresa_id, proceso.id, catalogo.detalle
FROM (
  SELECT 'GOBERNANTE' AS proceso, 'Direccionamiento y Conducción Estratégica del Hospital' AS detalle UNION ALL
  SELECT 'AGREGADOR_VALOR', 'Gestión de Especialidades Clínicas, Quirúrgicas o Clínico Quirúrgicas' UNION ALL
  SELECT 'AGREGADOR_VALOR', 'Gestión de Cuidados de Enfermería' UNION ALL
  SELECT 'AGREGADOR_VALOR', 'Gestión de Procesos de Apoyo Diagnóstico y Terapéutico' UNION ALL
  SELECT 'AGREGADOR_VALOR', 'Gestión de Docencia e Investigación' UNION ALL
  SELECT 'HABILITANTE_ASESORIA', 'Gestión de Planificación, Seguimiento y Evaluación de la Gestión' UNION ALL
  SELECT 'HABILITANTE_ASESORIA', 'Gestión de Calidad' UNION ALL
  SELECT 'HABILITANTE_APOYO', 'Gestión de Admisiones' UNION ALL
  SELECT 'HABILITANTE_APOYO', 'Gestión de Atención al Usuario/a' UNION ALL
  SELECT 'HABILITANTE_APOYO', 'Gestión Administrativa y Financiera' UNION ALL
  SELECT 'HABILITANTE_APOYO', 'Gestión de Tecnologías de la Información y Comunicaciones' UNION ALL
  SELECT 'HABILITANTE_APOYO', 'Gestión de Talento Humano'
) AS catalogo
JOIN procesos proceso ON proceso.codigo = catalogo.proceso
CROSS JOIN (SELECT @empresa_id AS empresa_id) hospital
LEFT JOIN areas existente
  ON existente.empresa_id = hospital.empresa_id
 AND existente.detalle = catalogo.detalle
WHERE existente.id IS NULL;

-- Subareas de Especialidades Clinicas, Quirurgicas o Clinico Quirurgicas
INSERT INTO areas (empresa_id, proceso_id, parent_id, detalle)
SELECT p.empresa_id, p.proceso_id, p.id, s.detalle
FROM areas p
JOIN (
  SELECT 'Especialidades' AS detalle UNION ALL
  SELECT 'Odontología' UNION ALL
  SELECT 'Obstetriz'
) s
WHERE p.empresa_id = @empresa_id
  AND p.detalle = 'Gestión de Especialidades Clínicas, Quirúrgicas o Clínico Quirúrgicas'
  AND NOT EXISTS (
    SELECT 1 FROM areas existente
    WHERE existente.empresa_id = p.empresa_id
      AND existente.detalle = s.detalle
  );

-- Subareas de Apoyo Diagnostico y Terapeutico
INSERT INTO areas (empresa_id, proceso_id, parent_id, detalle)
SELECT p.empresa_id, p.proceso_id, p.id, s.detalle
FROM areas p
JOIN (
  SELECT 'Centro Quirúrgico' AS detalle UNION ALL
  SELECT 'Terapia Intensiva' UNION ALL
  SELECT 'Imagenología' UNION ALL
  SELECT 'Laboratorio' UNION ALL
  SELECT 'Centro de Transfusión' UNION ALL
  SELECT 'Rehabilitación y Terapia Física' UNION ALL
  SELECT 'Rehabilitación y Terapia en Salud Mental' UNION ALL
  SELECT 'Farmacia, Insumos, Dispositivos Médicos y Reactivos' UNION ALL
  SELECT 'Nutrición y Dietética'
) s
WHERE p.empresa_id = @empresa_id
  AND p.detalle = 'Gestión de Procesos de Apoyo Diagnóstico y Terapéutico'
  AND NOT EXISTS (
    SELECT 1 FROM areas existente
    WHERE existente.empresa_id = p.empresa_id
      AND existente.detalle = s.detalle
  );

-- Subareas de Gestion Administrativa y Financiera
INSERT INTO areas (empresa_id, proceso_id, parent_id, detalle)
SELECT p.empresa_id, p.proceso_id, p.id, s.detalle
FROM areas p
JOIN (
  SELECT 'Gestión Financiera' AS detalle UNION ALL
  SELECT 'Gestión Administrativa'
) s
WHERE p.empresa_id = @empresa_id
  AND p.detalle = 'Gestión Administrativa y Financiera'
  AND NOT EXISTS (
    SELECT 1 FROM areas existente
    WHERE existente.empresa_id = p.empresa_id
      AND existente.detalle = s.detalle
  );

-- Verificacion: deben salir 12 areas principales y 14 subareas
SELECT SUM(parent_id IS NULL) AS areas_principales, SUM(parent_id IS NOT NULL) AS subareas
FROM areas WHERE empresa_id = @empresa_id;