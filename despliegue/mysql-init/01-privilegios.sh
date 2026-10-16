#!/bin/bash
# Se ejecuta una sola vez, al crear la base de datos del servidor.
# MySQL le da por defecto TODOS los permisos al usuario de la aplicacion sobre su base;
# aqui se reducen a leer y escribir datos. Crear o borrar tablas queda para el usuario de migraciones.

# La imagen oficial concede los permisos con cada "_" del nombre de la base escapado (hbsa\_vacaciones).
# Hay que usar exactamente ese patron: con el nombre sin escapar, MySQL responde que esa concesion no existe.
BASE_ESCAPADA="${MYSQL_DATABASE//_/\\_}"

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot <<SQL
REVOKE ALL PRIVILEGES ON \`${BASE_ESCAPADA}\`.* FROM '${MYSQL_USER}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${BASE_ESCAPADA}\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL