# Despliegue en el servidor del hospital

El sistema corre en contenedores Docker dentro de un servidor de la red interna. Solo el servidor web (nginx) publica puertos; la base de datos, Redis y el backend quedan en una red privada de Docker. El acceso es por HTTPS con un certificado emitido por una autoridad propia del hospital.

## Requisitos del servidor

- Linux con Docker Engine y el plugin Docker Compose.
- `openssl`, `curl` y, si se copian respaldos fuera del servidor, `rsync`.
- **Reloj sincronizado** (NTP): las sesiones y las horas guardadas dependen de él.
- Puertos 80 y 443 libres y abiertos hacia la red interna.

## Primera instalación

Desde la raíz del repositorio, con la dirección con la que los equipos entrarán al sistema:

```bash
bash despliegue/scripts/preparar.sh 192.168.1.50      # o vacaciones.hospital.local
bash despliegue/scripts/desplegar.sh
```

`preparar.sh` crea `despliegue/.env` con claves aleatorias y los certificados en `despliegue/certs`. **Guarda una copia del `.env` en un lugar seguro**: sin él no se puede abrir la base de datos. No se sube a git.

Después, crea el primer administrador del hospital (los números de empresa, área y cargo salen de los datos que cargues):

```bash
docker compose -f despliegue/docker-compose.prod.yml run --rm \
  -e SUPERADMIN_CORREO=admin@hospital.local -e SUPERADMIN_CLAVE='una-clave-larga-123' \
  -e SUPERADMIN_NOMBRES=Nombre -e SUPERADMIN_APELLIDOS=Apellido -e SUPERADMIN_CEDULA=0000000000 \
  -e SUPERADMIN_EMPRESA_ID=1 -e SUPERADMIN_AREA_ID=1 -e SUPERADMIN_CARGO_ID=1 \
  backend node dist/scripts/crearSuperadmin.js
```

## Que los equipos confíen en el certificado

Los navegadores avisan de "conexión no segura" hasta que el equipo confía en la autoridad del hospital. El área de sistemas debe instalar **`despliegue/certs/ca.crt`** como autoridad de certificación raíz de confianza, de preferencia con una política de grupo para todos los equipos. Se instala una sola vez: renovar el certificado del servidor no obliga a repetirlo.

La clave `ca.key` solo sirve para emitir certificados: guárdala fuera del servidor.

## Actualizar

```bash
git pull
bash despliegue/scripts/desplegar.sh
```

El script respalda la base antes de migrar y se detiene si el respaldo falla. Si el servidor no tiene acceso a internet, construye las imágenes en otro equipo, expórtalas con `docker save hbsa-backend:local hbsa-frontend:local | gzip > imagenes.tar.gz`, cárgalas con `gunzip -c imagenes.tar.gz | docker load` y usa `desplegar.sh local`.

## Respaldos

Programa el respaldo diario con cron (ejemplo dentro de `respaldo-programado.sh`) y define `RESPALDO_COPIA_DESTINO` en `.env` para copiarlo fuera del servidor. Los respaldos contienen datos personales: protégelos como la propia base.

Para restaurar, ver `database/README.md` (`restaurar.sh`) con `RESPALDO_VIA_DOCKER=1` y `RESPALDO_COMPOSE_ARCHIVO=despliegue/docker-compose.prod.yml`.

## Revisar el estado

```bash
docker compose -f despliegue/docker-compose.prod.yml ps
docker compose -f despliegue/docker-compose.prod.yml logs --tail=100 backend
curl -k https://localhost/salud
```

## Renovar el certificado del servidor

Vale 825 días. Antes de que venza:

```bash
bash despliegue/scripts/crear-certificados.sh 192.168.1.50 --renovar
docker compose -f despliegue/docker-compose.prod.yml restart frontend
```
