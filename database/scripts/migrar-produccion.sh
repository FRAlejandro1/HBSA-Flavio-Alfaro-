#!/usr/bin/env bash
# Procedimiento para migrar la base de produccion: respaldo, migraciones y datos base, en ese orden.
# Uso (desde la raiz del repositorio, con el backend ya compilado): bash database/scripts/migrar-produccion.sh
#
# Si el respaldo falla, NO se migra. Si la migracion falla, se indica como volver al respaldo.
# Variables: las de la aplicacion (DB_*), MIGRACION_DB_USER y MIGRACION_DB_PASSWORD para el usuario con DDL,
# y las de respaldar.sh. Nunca carga datos de demostracion.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
export NODE_ENV=production

echo "1/3 Respaldo previo"
salida="$(bash "$RAIZ/database/scripts/respaldar.sh")"
echo "$salida"
respaldo="${salida##*Respaldo creado: }"

echo "2/3 Migraciones"
if ! node "$RAIZ/backend/dist/scripts/migrar.js" migraciones; then
  echo "La migracion fallo. Revisa el error; para volver al estado anterior:" >&2
  echo "  CONFIRMAR_SOBRESCRITURA=SI bash database/scripts/restaurar.sh \"$respaldo\" \"$DB_NAME\"" >&2
  exit 1
fi

echo "3/3 Datos base (roles)"
node "$RAIZ/backend/dist/scripts/migrar.js" seeds

echo "Migracion terminada. Respaldo previo: $respaldo"