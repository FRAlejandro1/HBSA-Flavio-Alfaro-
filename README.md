# Documentación del sistema

Sistema de Vacaciones del Personal Hospitalario. Esta documentación se genera sola al final de cada validación del proyecto y explica, sin código, lo que existe y lo que cambió.

## Contenido

- [Arquitectura](arquitectura.md): Cómo está organizado el sistema y qué hace cada pieza.
- [Base de datos](base-de-datos.md): Las tablas, sus relaciones y las reglas que garantiza la propia base.
- [API](api.md): Las rutas del backend, quién puede usarlas y cómo responde ante errores.
- [Frontend](frontend.md): Las pantallas y piezas de la aplicación web.
- [Decisiones técnicas](decisiones-tecnicas.md): Qué se decidió, por qué y qué consecuencias tiene.
- [Cambios](cambios.md): Qué se agregó, corrigió o mejoró recientemente.

## Versión documentada

- Versión: 0.1.0
- Rama: main
- Cambio (commit): 221ff6b
- Generada: 2026-10-18 20:03 UTC

## Cobertura de las pruebas

Cada tipo de prueba mide qué parte del código recorre. Los porcentajes no se suman: unas pruebas cubren partes que otras no.

| Pruebas | Líneas | Cubiertas | Cobertura |
|---|---|---|---|
| Backend: E2E (MySQL y Redis reales) | 4273 | 1758 | 41.1 % |
| Backend: integración de repositorios (MySQL real) | 4273 | 1568 | 36.7 % |
| Backend: integración de módulos | 4273 | 2072 | 48.5 % |
| Backend: unitarias | 4273 | 2200 | 51.5 % |
| Frontend: unitarias | 33 | 33 | 100 % |

