-- Los 4 roles del sistema, con ids fijos para que el backend pueda referirse a ellos.
-- Se puede ejecutar varias veces sin duplicar datos.
INSERT INTO roles (id, codigo, detalle) VALUES
  (1, 'SUPERADMIN',     'Administrador del sistema, ve todos los hospitales'),
  (2, 'TALENTO_HUMANO', 'Talento Humano: gestiona usuarios y recibe los PDF'),
  (3, 'JEFE_AREA',      'Jefe de area: autoriza o niega solicitudes'),
  (4, 'EMPLEADO',       'Servidor que solicita vacaciones y permisos')
AS nuevo
ON DUPLICATE KEY UPDATE detalle = nuevo.detalle;