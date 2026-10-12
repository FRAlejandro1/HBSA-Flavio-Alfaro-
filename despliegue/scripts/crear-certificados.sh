#!/usr/bin/env bash
# Crea la autoridad certificadora (CA) interna del proyecto y un certificado de servidor para la
# direccion interna del hospital: una IP (192.168.1.50) o un nombre (vacaciones.hospital.local).
# Uso: bash despliegue/scripts/crear-certificados.sh <direccion> [--renovar]
# Resultado en despliegue/certs:
#   ca.crt        se instala en los equipos para que el navegador confie en el sistema
#   ca.key        clave de la CA: guardala fuera del servidor, solo hace falta para emitir certificados
#   servidor.crt  certificado del servidor (lo usa nginx)
#   servidor.key  clave del servidor (la usa nginx)
set -euo pipefail

DIRECCION="${1:?Uso: crear-certificados.sh <direccion-ip-o-nombre> [--renovar]}"
RENOVAR="${2:-}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
CERTS="$AQUI/../certs"

# Los navegadores validan la direccion contra el SAN: una IP necesita SAN de tipo IP, un nombre de tipo DNS
if [ "$DIRECCION" = "localhost" ]; then
  SAN="DNS:localhost,IP:127.0.0.1"
elif [[ "$DIRECCION" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  SAN="IP:$DIRECCION,IP:127.0.0.1,DNS:localhost"
elif [[ "$DIRECCION" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  SAN="DNS:$DIRECCION,DNS:localhost,IP:127.0.0.1"
else
  echo "Direccion invalida: $DIRECCION" >&2
  exit 1
fi

if [ -f "$CERTS/servidor.crt" ] && [ "$RENOVAR" != "--renovar" ]; then
  echo "Ya existen certificados en $CERTS. Para emitir uno nuevo agrega --renovar."
  exit 0
fi

mkdir -p "$CERTS"
# Todo lo que se crea queda legible solo por quien lo crea; la clave del servidor se ajusta al final
umask 077

# La CA se crea una sola vez: renovar el certificado del servidor no obliga a reinstalar la CA en los equipos
if [ ! -f "$CERTS/ca.key" ]; then
  openssl genrsa -out "$CERTS/ca.key" 4096
  openssl req -x509 -new -nodes -key "$CERTS/ca.key" -sha256 -days 3650 \
    -subj "/CN=HBSA CA interna" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out "$CERTS/ca.crt"
fi

openssl genrsa -out "$CERTS/servidor.key" 2048
openssl req -new -key "$CERTS/servidor.key" -subj "/CN=$DIRECCION" -out "$CERTS/servidor.csr"

cat > "$CERTS/servidor.ext" <<EOF
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$SAN
EOF

openssl x509 -req -in "$CERTS/servidor.csr" -CA "$CERTS/ca.crt" -CAkey "$CERTS/ca.key" -CAcreateserial \
  -out "$CERTS/servidor.crt" -days 825 -sha256 -extfile "$CERTS/servidor.ext"

rm -f "$CERTS/servidor.csr" "$CERTS/servidor.ext" "$CERTS/ca.srl"

# nginx corre sin privilegios dentro del contenedor y necesita leer la clave del servidor
chmod 644 "$CERTS/servidor.key" "$CERTS/servidor.crt" "$CERTS/ca.crt"
chmod 600 "$CERTS/ca.key"

echo "Certificados creados en $CERTS para: $SAN"
echo "Instala $CERTS/ca.crt como autoridad de confianza en los equipos que usaran el sistema."
