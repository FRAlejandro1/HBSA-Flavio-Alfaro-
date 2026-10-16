# API del backend

Lista de las rutas que ofrece el backend, detectadas del código. Todas las rutas que cambian datos exigen además la marca de seguridad contra ataques desde otros sitios.

## Auth

Prefijo: `/api/auth`

| Método | Ruta | Qué hace | Quién puede usarla |
|---|---|---|---|
| GET | `/api/auth/csrf` | Obtener csrf | Público |
| POST | `/api/auth/login` | Login | Público |
| POST | `/api/auth/refresh` | Refresh | Público |
| POST | `/api/auth/logout` | Logout | Cualquier persona con sesión iniciada |
| GET | `/api/auth/me` | Me | Cualquier persona con sesión iniciada |

## Importacion

Prefijo: `/api/importacion`

| Método | Ruta | Qué hace | Quién puede usarla |
|---|---|---|---|
| POST | `/api/importacion/personal/revisar` | Revisar | Roles: SUPERADMIN, TALENTO_HUMANO |
| POST | `/api/importacion/personal/aplicar` | Aplicar | Roles: SUPERADMIN, TALENTO_HUMANO |

## Organizacion

Prefijo: `/api/organizacion`

| Método | Ruta | Qué hace | Quién puede usarla |
|---|---|---|---|
| GET | `/api/organizacion/areas` | Listar areas | Cualquier persona con sesión iniciada |
| GET | `/api/organizacion/cargos` | Listar cargos | Cualquier persona con sesión iniciada |
| POST | `/api/organizacion/areas` | Crear area | Roles: SUPERADMIN |
| PATCH | `/api/organizacion/areas/:id` | Actualizar area | Roles: SUPERADMIN |
| DELETE | `/api/organizacion/areas/:id` | Eliminar area | Roles: SUPERADMIN |
| POST | `/api/organizacion/cargos` | Crear cargo | Roles: SUPERADMIN, TALENTO_HUMANO |
| PATCH | `/api/organizacion/cargos/:id` | Actualizar cargo | Roles: SUPERADMIN, TALENTO_HUMANO |
| DELETE | `/api/organizacion/cargos/:id` | Eliminar cargo | Roles: SUPERADMIN, TALENTO_HUMANO |

## Usuarios

Prefijo: `/api/usuarios`

| Método | Ruta | Qué hace | Quién puede usarla |
|---|---|---|---|
| GET | `/api/usuarios` | Listar | Roles: SUPERADMIN, TALENTO_HUMANO |
| POST | `/api/usuarios` | Crear | Roles: SUPERADMIN, TALENTO_HUMANO |
| GET | `/api/usuarios/:id` | Obtener | Roles: SUPERADMIN, TALENTO_HUMANO |
| PATCH | `/api/usuarios/:id` | Actualizar | Roles: SUPERADMIN, TALENTO_HUMANO |
| POST | `/api/usuarios/:id/baja` | Dar de baja | Roles: SUPERADMIN, TALENTO_HUMANO |
| POST | `/api/usuarios/:id/reactivar` | Reactivar | Roles: SUPERADMIN, TALENTO_HUMANO |

## Errores

Cuando algo falla, la API responde siempre con un código estable, un mensaje y, a veces, detalles por campo.

| Código | Estado HTTP |
|---|---|
| VALIDACION | 400 |
| NO_AUTENTICADO | 401 |
| PROHIBIDO | 403 |
| NO_ENCONTRADO | 404 |
| CONFLICTO | 409 |
| REGLA_DE_NEGOCIO | 422 |
| DEMASIADAS_PETICIONES | 429 |
| ERROR_INTERNO | 500 |

