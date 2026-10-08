# Sistema de Vacaciones del Personal Hospitalario

Repositorio del proyecto HBSA-Flavio-Alfaro. Permite registrar y gestionar las vacaciones y los permisos por hora del personal de un hospital, con aprobación en dos pasos (jefe inmediato y jefe de área) y envío del PDF final a Talento Humano.

Estado actual: **Sprint 0** (cimientos del repositorio y del flujo CI/CD).

## Estructura

```
HBSA-Flavio-Alfaro/
├── backend/    API en Node.js con Express y TypeScript
├── frontend/   SPA en React con Vite y TypeScript
├── database/   Migraciones y seeds de MySQL
└── .github/    Flujos de CI/CD
```

## Requisitos

- Node.js 20.19.4 (ver `.nvmrc`)
- npm 10 o superior
- MySQL 8.0 y Redis 7 (para desarrollo y pruebas de integración)

## Comandos

Desde la raíz del repositorio:

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias de todos los paquetes y activa los hooks de Husky |
| `npm run lint` | Ejecuta ESLint en cada paquete |
| `npm run typecheck` | Verifica los tipos en cada paquete |
| `npm run test` | Ejecuta todas las pruebas |
| `npm run test:unit` | Ejecuta solo las pruebas unitarias |
| `npm run build` | Compila cada paquete |

## Flujo de trabajo

- Ramas: `main` es la principal y `develop` es la rama por defecto. El trabajo se hace en `feature/*`, `fix/*` o `refactor/*` hacia `develop`, y `develop` pasa a `main` por pull request.
- Commits: Conventional Commits validados por Husky, con los tipos `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf` y `ci`. Ejemplo: `fix(auth): corrige la expiración del refresh`.
- Calidad: ESLint, verificación de tipos, pruebas con Vitest, cobertura LCOV y análisis en SonarCloud.

## Documentación de contexto para la IA

Cada área tiene su propio documento con reglas, archivos por sprint, deuda técnica y decisiones técnicas: frontend, backend, base de datos, pruebas y CI/CD. Se suben al chat al iniciar una sesión de trabajo de esa área.