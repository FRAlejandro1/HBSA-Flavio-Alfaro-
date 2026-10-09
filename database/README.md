# Base de datos

MySQL 8.0 con InnoDB y `utf8mb4`. Cada empresa del esquema es un hospital. Las reglas de negocio viven en el backend; la base solo garantiza integridad.

## Estructura

```
database/
├── migrations/   Esquema, en orden numerico. Una migracion aplicada no se edita: se crea otra.
├── seeds/        Datos iniciales (roles) y datos de demostracion (catalogos de ejemplo).
├── scripts/      migrar.sh: aplica migraciones pendientes y seeds.
└── docker/init/  Scripts que corren al crear el volumen de MySQL (base de pruebas).
```

## Entorno local

Desde la raiz del repositorio:

```bash
# Levanta MySQL 8.0 y Redis 7
docker compose up -d

# Espera a que ambos esten "healthy"
docker compose ps

# Aplica migraciones y seeds
chmod +x database/scripts/migrar.sh
./database/scripts/migrar.sh todo
```

Variables opcionales: `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` (por defecto, valores de desarrollo que coinciden con `backend/.env.example`).

## Bases

| Base | Uso |
|---|---|
| `hbsa_vacaciones` | Desarrollo |
| `hbsa_vacaciones_test` | Pruebas de integracion y E2E (se crea al iniciar el volumen) |

## Reiniciar desde cero

```bash
docker compose down -v
docker compose up -d
./database/scripts/migrar.sh todo
```

`down -v` borra el volumen: se pierden todos los datos locales.