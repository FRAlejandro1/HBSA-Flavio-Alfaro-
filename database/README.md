# Base de datos

MySQL 8.0 con InnoDB y `utf8mb4`. Cada empresa del esquema es un hospital. Las reglas de negocio viven en el backend; la base solo garantiza integridad.

## Estructura

```
database/
├── migrations/   Esquema, en orden numerico. Una migracion aplicada no se edita: se crea otra.
├── seeds/        Datos iniciales (roles) y de demostracion (archivos con "_demo" en el nombre).
├── scripts/      migrar.sh (desarrollo con Docker), respaldar.sh, restaurar.sh, migrar-produccion.sh.
└── docker/init/  Scripts que corren al crear el volumen de MySQL (base de pruebas).
```

## Entornos

| Entorno | Base | Quien la crea | Datos |
|---|---|---|---|
| Desarrollo | `hbsa_vacaciones` | `npm run migrar:local -w backend -- todo --demo` | Demostracion |
| Pruebas | `hbsa_vacaciones_test` | Las pruebas la recrean desde cero en cada ejecucion | Solo los de cada prueba |
| Produccion | La que defina el despliegue | `migrar-produccion.sh` | Solo roles y lo que cargue Talento Humano |

Las pruebas con base de datos real leen variables `TEST_*` y solo borran una base cuyo nombre termina en `_test`.

## Entorno local

```bash
docker compose up -d
docker compose ps
npm run migrar:local -w backend -- todo --demo
```

`migrar` registra cada migracion en `schema_migraciones` y nunca la repite. Sin `--demo` solo carga los datos base.

## Respaldo y restauracion

El respaldo contiene datos personales (cedulas, correos): guardalo cifrado (`RESPALDO_GPG_DESTINATARIO`) y fuera del servidor de la base.

```bash
bash database/scripts/respaldar.sh
bash database/scripts/restaurar.sh respaldos/<archivo> hbsa_verificacion
```

- Restaurar en una base nueva sirve para comprobar que un respaldo funciona. El flujo de CI lo hace en cada cambio.
- Para recuperar la base real, exporta `CONFIRMAR_SOBRESCRITURA=SI`: la base se borra y se recrea.
- En desarrollo con Docker, agrega `RESPALDO_VIA_DOCKER=1`.
- Se conservan 14 dias por defecto (`RETENCION_DIAS`).

## Migrar produccion

Antes de migrar siempre hay respaldo: `migrar-produccion.sh` lo hace primero y se detiene si falla. Requiere el backend compilado (`npm run build -w backend`). Usa `MIGRACION_DB_USER` para el usuario con permisos de DDL; el usuario de la aplicacion no los necesita.

## Reiniciar el entorno local

```bash
docker compose down -v
docker compose up -d
npm run migrar:local -w backend -- todo --demo
```

`down -v` borra el volumen: se pierden todos los datos locales.