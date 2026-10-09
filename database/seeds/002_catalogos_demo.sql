-- Datos de DEMOSTRACION para desarrollo: nunca se cargan en produccion.
-- Se puede ejecutar varias veces sin duplicar datos.

-- Zona 4
INSERT INTO zonas (id, detalle) VALUES
  (1, 'Zona 4')
AS nuevo
ON DUPLICATE KEY UPDATE detalle = nuevo.detalle;

-- Direccion provincial de la zona (nombre tomado del formulario de control de salida)
INSERT INTO direcciones_provinciales (id, zona_id, detalle) VALUES
  (1, 1, 'Coordinación Zonal 4 de Salud Manabí - Santo Domingo de los Tsáchilas')
AS nuevo
ON DUPLICATE KEY UPDATE detalle = nuevo.detalle;

-- Hospital de ejemplo (es la empresa de este tenant)
INSERT INTO empresas (id, direccion_provincial_id, nombre, lugar) VALUES
  (1, 1, 'Hospital Básico San Andrés', 'Flavio Alfaro')
AS nuevo
ON DUPLICATE KEY UPDATE lugar = nuevo.lugar;

-- Areas de ejemplo
INSERT INTO areas (id, empresa_id, detalle) VALUES
  (1, 1, 'Emergencia'),
  (2, 1, 'Consulta Externa'),
  (3, 1, 'Administración')
AS nuevo
ON DUPLICATE KEY UPDATE detalle = nuevo.detalle;

-- Cargos de ejemplo (la responsabilidad y las funciones reales las define Talento Humano)
INSERT INTO cargos (id, empresa_id, detalle, responsabilidad, funciones) VALUES
  (1, 1, 'Médico', 'Dato de prueba', 'Dato de prueba'),
  (2, 1, 'Enfermera', 'Dato de prueba', 'Dato de prueba'),
  (3, 1, 'Analista de Talento Humano', 'Dato de prueba', 'Dato de prueba')
AS nuevo
ON DUPLICATE KEY UPDATE detalle = nuevo.detalle;