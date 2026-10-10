#!/usr/bin/env bash
# Restaura un respaldo de respaldar.sh en una base de datos.
# Uso: bash database/scripts/restaurar.sh <archivo|ultimo> <base_destino>
#
# "ultimo" elige el respaldo mas reciente de la carpeta de respaldos.
# Para probar un respaldo, restaura en una base NUEVA (por ejemplo hbsa_verificacion).
# Si la base de destino ya tiene tablas, el script se niega, salvo que se exporte CONFIRMAR_SOBRESCRITURA=SI;
# en ese caso la base se borra y se vuelve a crear (es lo que se hace en una recuperacion real).
#
# Variables: las mismas de respaldar.sh (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, RESPALDO_DB_USER,
# RESPALDO_DB_PASSWORD, RESPALDO_DIR, RESPALDO_VIA_DOCKER, RESPALDO_COMPOSE_ARCHIVO, RESPALDO_SERVICIO_MYSQL).
# El usuario necesita permiso para crear bases de datos.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ARCHIVO="${1:?Uso: restaurar.sh <archivo|ultimo> <base_destino>}"
DESTINO="${2:?Uso: restaurar.sh <archivo|ultimo> <base_destino>}"
HOST="${DB_HOST:-localhost}"
PUERTO="${DB_PORT:-3306}"
USUARIO="${RESPALDO_DB_USER:-${DB_USER:?Falta DB_USER}}"
CLAVE="${RESPALDO_DB_PASSWORD:-${DB_PASSWORD:?Falta DB_PASSWORD}}"
DIRECTORIO="${RESPALDO_DIR:-$RAIZ/respaldos}"
ARCHIVO_COMPOSE="${RESPALDO_COMPOSE_ARCHIVO:-$RAIZ/docker-compose.yml}"
SERVICIO_MYSQL="${RESPALDO_SERVICIO_MYSQL:-mysql}"

# "ultimo" busca el respaldo mas reciente de la carpeta
if [ "$ARCHIVO" = "ultimo" ]; then
  ARCHIVO="$(ls -1t "$DIRECTORIO"/*.sql.gz "$DIRECTORIO"/*.sql.gz.gpg 2>/dev/null | head -n 1 || true)"
  if [ -z "$ARCHIVO" ]; then
    echo "No hay respaldos en $DIRECTORIO" >&2
    exit 1
  fi
  echo "Usando el respaldo mas reciente: $ARCHIVO"
fi

if [ ! -f "$ARCHIVO" ]; then
  echo "No existe el archivo: $ARCHIVO" >&2
  exit 1
fi

# El nombre se escribe dentro de sentencias SQL: solo se aceptan letras, numeros y guion bajo
if [[ ! "$DESTINO" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Nombre de base invalido: $DESTINO" >&2
  exit 1
fi

# Cliente mysql (por docker compose si se pide, directo en cualquier otro caso)
cliente() {
  if [ "${RESPALDO_VIA_DOCKER:-0}" = "1" ]; then
    docker compose -f "$ARCHIVO_COMPOSE" exec -T -e MYSQL_PWD="$CLAVE" "$SERVICIO_MYSQL" \
      mysql -u"$USUARIO" --default-character-set=utf8mb4 "$@"
  else
    MYSQL_PWD="$CLAVE" mysql -h"$HOST" -P"$PUERTO" -u"$USUARIO" --default-character-set=utf8mb4 "$@"
  fi
}

# Lee el respaldo, descifrandolo si hace falta
leer_respaldo() {
  case "$ARCHIVO" in
    *.gpg) gpg --batch --decrypt "$ARCHIVO" | gunzip ;;
    *) gunzip -c "$ARCHIVO" ;;
  esac
}

existentes="$(cliente -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DESTINO'" | tr -d '[:space:]')"
if [ "$existentes" != "0" ] && [ "${CONFIRMAR_SOBRESCRITURA:-}" != "SI" ]; then
  echo "La base $DESTINO ya tiene tablas. Para reemplazarla exporta CONFIRMAR_SOBRESCRITURA=SI" >&2
  exit 1
fi

echo "Creando la base $DESTINO"
cliente -e "DROP DATABASE IF EXISTS \`$DESTINO\`; CREATE DATABASE \`$DESTINO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"

# Se quita DEFINER de los triggers: el usuario que los creo puede no existir en este servidor
echo "Restaurando $ARCHIVO"
leer_respaldo | sed -E 's/DEFINER=`[^`]+`@`[^`]+`//g' | cliente "$DESTINO"

tablas="$(cliente -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DESTINO'" | tr -d '[:space:]')"
triggers="$(cliente -N -e "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$DESTINO'" | tr -d '[:space:]')"
echo "Restauracion terminada en $DESTINO: $tablas tablas, $triggers triggers"