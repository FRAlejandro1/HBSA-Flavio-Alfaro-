-- ============================================================
-- test/001_datos_prueba.sql
-- SOLO PARA LA BASE DE DATOS DE PRUEBAS: personal ficticio con jefes, periodos de vacaciones,
-- feriados y un segundo hospital para probar el aislamiento entre hospitales.
-- Se corre una vez, despues de 002 a 004. Las personas no tienen clave (no inician sesion):
-- las pruebas del backend firman sus propios tokens.
-- ============================================================
SET NAMES utf8mb4;

-- Hospital principal (el mismo de los seeds 002 a 004)
SET @hospital = 'Hospital Básico San Andrés';
SET @e = (SELECT id FROM empresas WHERE nombre = @hospital);

-- Personal. Cadena de jefes: Director <- Subdirectora <- jefes de area <- empleados.
-- Cada persona guarda su id en una variable para usarla como jefe de las siguientes.

-- SUPERADMIN: mantiene el sistema, no pertenece a la cadena de mando
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Tecnologías de la Información y Comunicaciones'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Analista de Tecnologías de la Información y Comunicaciones 2'),
  (SELECT id FROM roles WHERE codigo = 'SUPERADMIN'), NULL,
  '0900000001', 'Sara', 'Superadmin', 'sara.superadmin@hospital.test', '0990000001', '2020-01-15');
SET @superadmin = LAST_INSERT_ID();

-- Director: maxima autoridad, no tiene jefe inmediato
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Direccionamiento y Conducción Estratégica del Hospital'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Director/a de Hospital Básico'),
  (SELECT id FROM roles WHERE codigo = 'JEFE_AREA'), NULL,
  '0900000002', 'Diego', 'Director', 'diego.director@hospital.test', '0990000002', '2018-03-01');
SET @director = LAST_INSERT_ID();

-- Subdirectora: su jefe es el Director
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Direccionamiento y Conducción Estratégica del Hospital'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Subdirector/a de Hospital Básico'),
  (SELECT id FROM roles WHERE codigo = 'JEFE_AREA'), @director,
  '0900000003', 'Silvia', 'Subdirectora', 'silvia.subdirectora@hospital.test', '0990000003', '2019-05-10');
SET @subdirectora = LAST_INSERT_ID();

-- Talento Humano: jefa del area y analista
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Talento Humano'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Jefe/a de Área'),
  (SELECT id FROM roles WHERE codigo = 'JEFE_AREA'), @subdirectora,
  '0900000004', 'Teresa', 'Jefa Talento', 'teresa.jefa@hospital.test', '0990000004', '2019-08-20');
SET @jefa_th = LAST_INSERT_ID();

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Talento Humano'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Analista de Talento Humano 2'),
  (SELECT id FROM roles WHERE codigo = 'TALENTO_HUMANO'), @jefa_th,
  '0900000005', 'Tomás', 'Talento', 'tomas.talento@hospital.test', '0990000005', '2021-02-01');
SET @talento = LAST_INSERT_ID();

-- Laboratorio: jefa y dos empleados
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Laboratorio'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Jefe/a de Área'),
  (SELECT id FROM roles WHERE codigo = 'JEFE_AREA'), @subdirectora,
  '0900000006', 'Laura', 'Jefa Laboratorio', 'laura.jefa@hospital.test', '0990000006', '2020-06-01');
SET @jefa_lab = LAST_INSERT_ID();

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Laboratorio'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Laboratorista Clínico 3'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @jefa_lab,
  '0900000007', 'Luis', 'Laboratorista', 'luis.laboratorista@hospital.test', '0990000007', '2022-01-10');
SET @luis = LAST_INSERT_ID();

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Laboratorio'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Tecnólogo Médico de Laboratorio 4'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @jefa_lab,
  '0900000008', 'Lucía', 'Tecnóloga', 'lucia.tecnologa@hospital.test', '0990000008', '2021-09-15');
SET @lucia = LAST_INSERT_ID();

-- Enfermeria: jefa y dos enfermeros
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Cuidados de Enfermería'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Enfermero/a 6'),
  (SELECT id FROM roles WHERE codigo = 'JEFE_AREA'), @subdirectora,
  '0900000009', 'Nora', 'Jefa Enfermería', 'nora.jefa@hospital.test', '0990000009', '2019-11-04');
SET @jefa_enf = LAST_INSERT_ID();

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Cuidados de Enfermería'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Enfermero/a 3'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @jefa_enf,
  '0900000010', 'Ernesto', 'Enfermero', 'ernesto.enfermero@hospital.test', '0990000010', '2023-04-17');
SET @ernesto = LAST_INSERT_ID();

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Gestión de Cuidados de Enfermería'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Enfermero/a 4'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @jefa_enf,
  '0900000011', 'Elisa', 'Enfermera', 'elisa.enfermera@hospital.test', '0990000011', '2022-07-25');
SET @elisa = LAST_INSERT_ID();

-- Medico de Especialidades: su jefe directo es la Subdirectora (no hay jefe de area intermedio)
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Especialidades'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Médico/a Especialista en Medicina Interna 1'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @subdirectora,
  '0900000012', 'Manuel', 'Médico', 'manuel.medico@hospital.test', '0990000012', '2020-10-05');
SET @manuel = LAST_INSERT_ID();

-- Caso limite: empleado sin jefe inmediato asignado
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Farmacia, Insumos, Dispositivos Médicos y Reactivos'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Químico / Bioquímico Farmacéutico 3'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), NULL,
  '0900000013', 'Pablo', 'Sinjefe', 'pablo.sinjefe@hospital.test', NULL, '2021-03-22');
SET @pablo = LAST_INSERT_ID();

-- Caso limite: persona dada de baja (no debe aparecer como aprobador ni solicitante activo)
INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, estado, fecha_baja, cedula, nombres, apellidos, email, telefono, fecha_ingreso)
VALUES (@e,
  (SELECT id FROM areas  WHERE empresa_id = @e AND detalle = 'Laboratorio'),
  (SELECT id FROM cargos WHERE empresa_id = @e AND detalle = 'Laboratorista Clínico 2'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), @jefa_lab, 'INACTIVO', '2026-06-30',
  '0900000014', 'Iván', 'Inactivo', 'ivan.inactivo@hospital.test', NULL, '2019-02-11');

-- Jefes de las areas que los tienen
UPDATE areas SET jefe_id = @director WHERE empresa_id = @e AND detalle = 'Direccionamiento y Conducción Estratégica del Hospital';
UPDATE areas SET jefe_id = @jefa_th WHERE empresa_id = @e AND detalle = 'Gestión de Talento Humano';
UPDATE areas SET jefe_id = @jefa_lab WHERE empresa_id = @e AND detalle = 'Laboratorio';
UPDATE areas SET jefe_id = @jefa_enf WHERE empresa_id = @e AND detalle = 'Gestión de Cuidados de Enfermería';

-- Segundo hospital: sirve para comprobar que nadie ve ni aprueba datos de otro hospital.
-- La cedula de Ana se repite a proposito con la de Luis: la cedula es unica por hospital, no global.
INSERT INTO empresas (direccion_provincial_id, nombre, lugar)
SELECT direccion_provincial_id, 'Hospital Basico de Prueba Ajeno', 'Pedernales' FROM empresas WHERE id = @e;
SET @e2 = LAST_INSERT_ID();

INSERT INTO areas (empresa_id, proceso_id, detalle)
VALUES (@e2, (SELECT id FROM procesos WHERE codigo = 'AGREGADOR_VALOR'), 'Laboratorio');

INSERT INTO cargos (empresa_id, detalle, grado, nivel_jerarquico, responsabilidad, funciones)
VALUES (@e2, 'Laboratorista Clínico 3', 3, 5,
        'Responde por el procesamiento de las muestras del laboratorio.',
        'Recibe y procesa muestras; valida y entrega resultados.');

INSERT INTO usuarios (empresa_id, area_id, cargo_id, rol_id, jefe_inmediato_id, cedula, nombres, apellidos, email, fecha_ingreso)
VALUES (@e2,
  (SELECT id FROM areas  WHERE empresa_id = @e2 AND detalle = 'Laboratorio'),
  (SELECT id FROM cargos WHERE empresa_id = @e2 AND detalle = 'Laboratorista Clínico 3'),
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), NULL,
  '0900000007', 'Ana', 'Ajena', 'ana.ajena@hospital.test', '2022-01-10');

-- El segundo hospital usa el mismo plazo y las mismas rutas de aprobacion que el primero
INSERT INTO config_aprobacion (empresa_id, plazo_horas)
SELECT @e2, plazo_horas FROM config_aprobacion WHERE empresa_id = @e;
INSERT INTO rutas_aprobacion (empresa_id, nivel_solicitante, orden, tipo_aprobador)
SELECT @e2, nivel_solicitante, orden, tipo_aprobador FROM rutas_aprobacion WHERE empresa_id = @e;

-- Dos periodos de vacaciones por persona, con 30 dias de derecho y ninguno usado (FIFO: se consume el de 2025 primero)
INSERT INTO periodos_vacaciones (empresa_id, usuario_id, fecha_inicio, fecha_caducidad, dias_derecho)
SELECT u.empresa_id, u.id, p.inicio, DATE_ADD(p.inicio, INTERVAL 2 YEAR), 30
FROM usuarios u
JOIN (SELECT '2025-01-01' AS inicio UNION ALL SELECT '2026-01-01') p
WHERE u.empresa_id IN (@e, @e2);

-- Feriados de prueba para el calculo de dias laborables (no es el calendario oficial)
INSERT INTO feriados (fecha, detalle) VALUES
  ('2026-11-02', 'Dia de los Difuntos'),
  ('2026-11-03', 'Independencia de Cuenca'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Anio Nuevo');

-- Verificacion: 14 personas en el hospital principal y 1 en el ajeno, 30 periodos
SELECT (SELECT COUNT(*) FROM usuarios WHERE empresa_id = @e)  AS personas,
       (SELECT COUNT(*) FROM usuarios WHERE empresa_id = @e2) AS personas_ajeno,
       (SELECT COUNT(*) FROM periodos_vacaciones)             AS periodos;
