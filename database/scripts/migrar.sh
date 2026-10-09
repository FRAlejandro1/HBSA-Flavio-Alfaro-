#!/usr/bin/env bash
# Aplica las migraciones pendientes y los seeds sobre el MySQL de docker compose.
# Uso: ./database/scripts/migrar.sh [todo|migraciones|seeds]
# Las migraciones se registran en la tabla schema_migraciones y nunca se repiten.
# Los seeds se pueden ejecutar siempre porque son idempotentes.
# Ante cualquier error el script se detiene: nada se da por aplicado sin comprobarlo.
set -euo pipefail

DIRECTORIO="$(cd "$(dirname "$0")/.." && pwd)"
RAIZ="$(cd "$DIRECTORIO/.." && pwd)"
BD="${DB_NAME:-hbsa_vacaciones}"
CLAVE_ROOT="${MYSQL_ROOT_PASSWORD:-raiz-solo-desarrollo}"
MODO="${1:-todo}"

# Ejecuta un comando dentro del contenedor de MySQL
en_contenedor() {
  docker compose -f "$RAIZ/docker-compose.yml" exec -T -e MYSQL_PWD="$CLAVE_ROOT" mysql "$@"
}

# Ejecuta SQL en la base del proyecto (por entrada estandar o con -e)
mysql_bd() {
  en_contenedor mysql -uroot --default-character-set=utf8mb4 "$BD" "$@"
}

# Espera hasta 90 segundos a que MySQL acepte conexiones por TCP
# (durante el arranque inicial el servidor temporal no atiende por TCP)
esperar_mysql() {
  echo "Esperando a MySQL..."
  for _ in $(seq 1 45); do
    if en_contenedor mysqladmin ping -h 127.0.0.1 -uroot --silent >/dev/null 2>&1; then
      echo "MySQL listo."
      return 0
    fi
    sleep 2
  done
  echo "MySQL no respondio a tiempo. Revisa: docker compose logs mysql" >&2
  exit 1
}

# Aplica en orden las migraciones que aun no estan registradas
aplicar_migraciones() {
  # Tabla de control de migraciones aplicadas
  mysql_bd -e "CREATE TABLE IF NOT EXISTS schema_migraciones (archivo VARCHAR(150) NOT NULL PRIMARY KEY, aplicada_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"

  for archivo in "$DIRECTORIO"/migrations/*.sql; do
    nombre="$(basename "$archivo")"

    # Consulta si ya esta registrada; si la consulta falla, se detiene en vez de suponer
    if ! consulta="$(mysql_bd -N -e "SELECT COUNT(*) FROM schema_migraciones WHERE archivo = '$nombre'")"; then
      echo "No se pudo consultar schema_migraciones" >&2
      exit 1
    fi
    ya="$(echo "$consulta" | tr -d '[:space:]')"

    if [ "$ya" = "0" ]; then
      echo "Aplicando migracion: $nombre"
      mysql_bd < "$archivo"
      mysql_bd -e "INSERT INTO schema_migraciones (archivo) VALUES ('$nombre')"
    elif [ "$ya" = "1" ]; then
      echo "Ya aplicada: $nombre"
    else
      echo "Respuesta inesperada al consultar $nombre: '$ya'" >&2
      exit 1
    fi
  done
}

# Ejecuta todos los seeds en orden
aplicar_seeds() {
  for archivo in "$DIRECTORIO"/seeds/*.sql; do
    echo "Cargando seed: $(basename "$archivo")"
    mysql_bd < "$archivo"
  done
}

esperar_mysql

case "$MODO" in
  migraciones)
    aplicar_migraciones
    ;;
  seeds)
    aplicar_seeds
    ;;
  todo)
    aplicar_migraciones
    aplicar_seeds
    ;;
  *)
    echo "Uso: $0 [todo|migraciones|seeds]" >&2
    exit 1
    ;;
esac

echo "Listo."