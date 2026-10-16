#!/usr/bin/env bash
# Prepara el servidor la primera vez: crea despliegue/.env con claves aleatorias y los certificados HTTPS.
# Uso: bash despliegue/scripts/preparar.sh <direccion-interna>
# Ejemplos: preparar.sh 192.168.1.50   |   preparar.sh vacaciones.hospital.local
set -euo pipefail

DIRECCION="${1:?Uso: preparar.sh <ip-o-nombre-interno>}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
DESPLIEGUE="$AQUI/.."
ENTORNO="$DESPLIEGUE/.env"

# Nunca se sobrescribe: cambiar las claves de una base ya creada dejaria el sistema inaccesible
if [ -f "$ENTORNO" ]; then
  echo "Ya existe $ENTORNO: no se sobrescribe. Borralo solo si vas a empezar de cero." >&2
  exit 1
fi

# 24 bytes aleatorios en hexadecimal: 48 caracteres, sin simbolos que compliquen URLs o comandos
secreto() {
  openssl rand -hex 24
}

# El archivo .env solo lo puede leer quien lo crea
umask 077
sed \
  -e "s/__DIRECCION__/$DIRECCION/g" \
  -e "s/__DB_PASSWORD__/$(secreto)/" \
  -e "s/__MYSQL_ROOT_PASSWORD__/$(secreto)/" \
  -e "s/__REDIS_PASSWORD__/$(secreto)/" \
  -e "s/__JWT_ACCESS_SECRET__/$(secreto)/" \
  -e "s/__JWT_REFRESH_SECRET__/$(secreto)/" \
  "$DESPLIEGUE/.env.example" > "$ENTORNO"
echo "Creado $ENTORNO con claves aleatorias. Guardalo en un lugar seguro: sin el no se puede abrir la base."

bash "$AQUI/crear-certificados.sh" "$DIRECCION"
