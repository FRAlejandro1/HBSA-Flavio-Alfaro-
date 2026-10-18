-- Catalogos base del hospital para pruebas y ejecuciones sin datos demo.
-- Idempotente: recupera los IDs existentes mediante las claves naturales.
SET NAMES utf8mb4;

INSERT INTO zonas (detalle)
VALUES ('Zona 4')
AS nuevo
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id);
SET @zona_id = LAST_INSERT_ID();

INSERT INTO direcciones_provinciales (zona_id, detalle)
VALUES (@zona_id, 'Coordinación Zonal 4 de Salud Manabí - Santo Domingo de los Tsáchilas')
AS nuevo
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id);
SET @direccion_provincial_id = LAST_INSERT_ID();

INSERT INTO empresas (direccion_provincial_id, nombre, lugar)
VALUES (@direccion_provincial_id, 'Hospital Básico San Andrés', 'Flavio Alfaro')
AS nuevo
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id);
