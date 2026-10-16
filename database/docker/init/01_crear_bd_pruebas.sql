-- Base separada para las pruebas de integracion y E2E: nunca se mezclan con los datos de desarrollo.
-- Corre una sola vez, al crear el volumen de MySQL. Usa el usuario por defecto hbsa_app.
CREATE DATABASE IF NOT EXISTS hbsa_vacaciones_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- El usuario de la aplicacion puede operar sobre la base de pruebas
GRANT ALL PRIVILEGES ON hbsa_vacaciones_test.* TO 'hbsa_app'@'%';
FLUSH PRIVILEGES;