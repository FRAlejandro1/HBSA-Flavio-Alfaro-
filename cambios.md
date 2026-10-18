# Cambios recientes

Resumen de los últimos cambios del proyecto, agrupados por tipo. Se arma con los mensajes de commit, que siguen un formato fijo.

## Nuevas funciones

- incorporar modulo de vacaciones y escalamiento de aprobaciones (2026-10-18, 8e7565a)
- incorporar estructura organizativa y flujo de aprobación (2026-10-18, c5d1a17)
- incorporar plantilla para importación de personal (2026-10-14, fb99a2b)
- **docker**: imágenes, despliegue en el servidor del hospital y confianza en nginx (2026-10-12, cde479a)
- **sonarcloud**: ingreso de sonar-project (2026-10-11, 55df3fe)
- **database**: instantes en UTC y fecha de calendario de la solicitud (2026-10-11, 8e6041f)
- **docs**: generador de documentación y respaldo con compose configurable (2026-10-10, e961579)
- **organizacion**: áreas y cargos por hospital (2026-10-09, 40950a8)
- **auth**: login, refresh con rotación, logout y script de superadmin (2026-10-09, 765c959)
- **backend**: infraestructura de autenticación y middlewares (2026-10-09, 7112a6d)
- **database**: correo único global y baja de personal (2026-10-09, 57f5f27)
- **database**: esquema inicial, triggers y datos base (2026-10-09, 1d24c74)
- **backend**: app base, manejo de errores y utilidades (2026-10-08, de92e70)
- **backend**: configuración base del servidor (2026-10-08, 93b0b85)

## Correcciones

- corregir restauración de triggers (2026-10-16, f4bbc05)
- **importacion**: reconocer las variantes de la cédula del jefe y corregir pruebas (2026-10-14, 453ceaf)
- **despliegue**: montar solo los certificados del servidor y mostrar diagnóstico al fallar (2026-10-13, 43dd614)

## Mejoras internas

- centralizar utilidades de controladores de vacaciones (2026-10-18, fb5bfad)

## Pruebas

- **backend**: pruebas con MySQL y Redis reales y migrador, incluyendo módulos de usuario y auth (2026-10-10, d261ee7)

## Documentación

- decisiones técnicas iniciales (2026-10-10, 269425c)
- inicializa README del proyecto (2026-10-08, 56ff400)

## Integración continua

- habilitar CI en rama de validacion (2026-10-18, 8b15c0f)
- SonarCloud se ejecuta solo sobre main (2026-10-13, 4efdbfb)
- relanzar el flujo (2026-10-13, 5d8a28a)
- acción de SonarCloud v6 y comprobación previa de su configuración (2026-10-11, 3f48131)
- flujos separados por área (backend, frontend, base de datos) (2026-10-11, d47a59f)
- flujo base de lint y tipos (2026-10-09, 83b4d1b)

## Mantenimiento

- entorno local con docker compose (2026-10-09, 993a4ab)
- **frontend**: configuración base del paquete (2026-10-09, 2beb156)
- **backend**: configuración base del paquete (2026-10-08, 8cff946)
- configuración inicial del monorepo (2026-10-08, 9b7f662)

## Otros cambios

- Modificar SonarCloud para CI/CD (2026-10-13, a9f6dfc)
- Initial commit (2026-10-08, 52dbead)

