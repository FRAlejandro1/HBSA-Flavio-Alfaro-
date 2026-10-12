#!/usr/bin/env bash
# Despliega o actualiza el sistema en el servidor: imagenes, respaldo previo, migraciones y arranque.
# Uso: bash despliegue/scripts/desplegar.sh [construir|descargar|local]
#   construir  (por defecto) construye las imagenes en este servidor a partir del codigo
#   descargar  descarga las imagenes ya publicadas (BACKEND_IMAGE y FRONTEND_IMAGE en .env)
#   local      usa las imagenes que ya estan en este servidor (por ejemplo cargadas con docker load)
# Es seguro repetirlo: solo se aplican las migraciones pendientes.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
cd "$AQUI/.."
MODO="${1:-construir}"

if [ ! -f .env ]; then
  echo "Falta despliegue/.env: ejecuta primero preparar.sh <direccion-interna>" >&2
  exit 1
fi
if [ ! -f certs/servidor.crt ]; then
  echo "Faltan los certificados: ejecuta crear-certificados.sh <direccion-interna>" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

COMPOSE=(docker compose -f docker-compose.prod.yml)

case "$MODO" in
  construir) "${COMPOSE[@]}" build ;;
  descargar) "${COMPOSE[@]}" pull backend frontend ;;
  local) ;;
  *)
    echo "Modo desconocido: $MODO (usa construir, descargar o local)" >&2
    exit 1
    ;;
esac

echo "1/5 Base de datos y Redis"
"${COMPOSE[@]}" up -d --wait mysql redis

echo "2/5 Respaldo previo"
tablas="$("${COMPOSE[@]}" exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql mysql -uroot -N \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME'" | tr -d '[:space:]')"
if [ "$tablas" != "0" ]; then
  # Si el respaldo falla el script se detiene: no se migra sin copia
  RESPALDO_VIA_DOCKER=1 RESPALDO_COMPOSE_ARCHIVO="$PWD/docker-compose.prod.yml" \
    DB_USER=root DB_PASSWORD="$MYSQL_ROOT_PASSWORD" RESPALDO_DIR="${RESPALDO_DIR:-$PWD/respaldos}" \
    bash ../database/scripts/respaldar.sh
else
  echo "La base esta vacia: no hay nada que respaldar"
fi

echo "3/5 Migraciones y datos base"
"${COMPOSE[@]}" run --rm migracion
"${COMPOSE[@]}" run --rm migracion node dist/scripts/migrar.js seeds

echo "4/5 Aplicacion"
"${COMPOSE[@]}" up -d --wait backend frontend

echo "5/5 Verificacion"
curl -ksf "https://localhost:${PUERTO_HTTPS:-443}/salud" > /dev/null
echo "Listo. El sistema responde en https://${DIRECCION_INTERNA:-localhost}"
