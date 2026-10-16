#!/usr/bin/env bash
# Respaldo logico de la base de datos con mysqldump: comprimido, verificado y con retencion.
# Uso: bash database/scripts/respaldar.sh
#
# Variables:
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD   conexion (las mismas de la aplicacion)
#   RESPALDO_DB_USER, RESPALDO_DB_PASSWORD            usuario dedicado al respaldo (opcional)
#   RESPALDO_DIR                                      carpeta de destino (por defecto ./respaldos)
#   RETENCION_DIAS                                    dias que se conservan los respaldos (por defecto 14)
#   RESPALDO_GPG_DESTINATARIO                         cifra el archivo con la clave publica de esa persona (opcional)
#   RESPALDO_VIA_DOCKER=1                             usa el MySQL de un docker compose
#   RESPALDO_COMPOSE_ARCHIVO                          archivo compose a usar (por defecto el de desarrollo)
#   RESPALDO_SERVICIO_MYSQL                           nombre del servicio MySQL en el compose (por defecto mysql)
#
# El respaldo contiene datos personales: guardalo cifrado y fuera del servidor de la base de datos.
set -euo pipefail

# Los archivos creados solo los puede leer quien ejecuta el script
umask 077

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
BD="${DB_NAME:?Falta DB_NAME}"
HOST="${DB_HOST:-localhost}"
PUERTO="${DB_PORT:-3306}"
USUARIO="${RESPALDO_DB_USER:-${DB_USER:?Falta DB_USER}}"
CLAVE="${RESPALDO_DB_PASSWORD:-${DB_PASSWORD:?Falta DB_PASSWORD}}"
DIRECTORIO="${RESPALDO_DIR:-$RAIZ/respaldos}"
RETENCION="${RETENCION_DIAS:-14}"
GPG_DESTINATARIO="${RESPALDO_GPG_DESTINATARIO:-}"
ARCHIVO_COMPOSE="${RESPALDO_COMPOSE_ARCHIVO:-$RAIZ/docker-compose.yml}"
SERVICIO_MYSQL="${RESPALDO_SERVICIO_MYSQL:-mysql}"

# Si algo falla, no se deja un archivo a medias que parezca un respaldo valido
destino=""
limpiar() {
  local codigo=$?
  if [ "$codigo" -ne 0 ] && [ -n "$destino" ]; then
    rm -f "$destino"
  fi
}
trap limpiar EXIT

# Vuelca la base: transaccion unica (sin bloquear la aplicacion), con rutinas, triggers y eventos
volcar() {
  local opciones=(
    --single-transaction --quick --routines --triggers --events
    --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4
  )
  if [ "${RESPALDO_VIA_DOCKER:-0}" = "1" ]; then
    docker compose -f "$ARCHIVO_COMPOSE" exec -T -e MYSQL_PWD="$CLAVE" "$SERVICIO_MYSQL" \
      mysqldump -u"$USUARIO" "${opciones[@]}" "$BD"
  else
    MYSQL_PWD="$CLAVE" mysqldump -h"$HOST" -P"$PUERTO" -u"$USUARIO" "${opciones[@]}" "$BD"
  fi
}

mkdir -p "$DIRECTORIO"
marca="$(date -u +%Y%m%dT%H%M%SZ)"

if [ -n "$GPG_DESTINATARIO" ]; then
  destino="$DIRECTORIO/${BD}_${marca}.sql.gz.gpg"
  volcar | gzip -9 | gpg --batch --yes --trust-model always --encrypt --recipient "$GPG_DESTINATARIO" -o "$destino"
else
  destino="$DIRECTORIO/${BD}_${marca}.sql.gz"
  volcar | gzip -9 > "$destino"
fi

# Verificacion: el archivo existe y no esta vacio
if [ ! -s "$destino" ]; then
  echo "El respaldo quedo vacio: $destino" >&2
  exit 1
fi

# Sin cifrar se comprueba ademas la integridad del gzip y que mysqldump llego hasta el final
if [ -z "$GPG_DESTINATARIO" ]; then
  gzip -t "$destino"
  if ! gzip -dc "$destino" | tail -n 1 | grep -q 'Dump completed'; then
    echo "El respaldo esta incompleto: no termina con la marca de mysqldump" >&2
    exit 1
  fi
fi

# Retencion: se borran solo los respaldos de esta base mas viejos que el limite
find "$DIRECTORIO" -maxdepth 1 -type f -name "${BD}_*.sql.gz*" -mtime +"$RETENCION" -delete

echo "Respaldo creado: $destino"