#!/usr/bin/env bash
# Respaldo de la base de produccion pensado para cron. Usa el MySQL del compose de produccion.
# Si RESPALDO_COPIA_DESTINO esta definido en .env, copia los respaldos fuera del servidor con rsync.
# Ejemplo de cron (todos los dias a las 02:00):
#   0 2 * * * /ruta/al/repositorio/despliegue/scripts/respaldo-programado.sh >> /var/log/hbsa-respaldo.log 2>&1
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
DESPLIEGUE="$AQUI/.."
cd "$DESPLIEGUE"

set -a
# shellcheck disable=SC1091
. ./.env
set +a

DIRECTORIO="${RESPALDO_DIR:-$DESPLIEGUE/respaldos}"

RESPALDO_VIA_DOCKER=1 RESPALDO_COMPOSE_ARCHIVO="$DESPLIEGUE/docker-compose.prod.yml" \
  DB_USER=root DB_PASSWORD="$MYSQL_ROOT_PASSWORD" RESPALDO_DIR="$DIRECTORIO" \
  bash "$DESPLIEGUE/../database/scripts/respaldar.sh"

# Un respaldo que solo existe en el mismo servidor no protege contra la perdida del servidor
if [ -n "${RESPALDO_COPIA_DESTINO:-}" ]; then
  rsync -a "$DIRECTORIO"/ "$RESPALDO_COPIA_DESTINO"/
  echo "Respaldos copiados a $RESPALDO_COPIA_DESTINO"
fi
