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
- Cambio (commit): 0a853a8
- Generada: 2026-10-16 23:39 UTC

## Cobertura de las pruebas

Cada tipo de prueba mide qué parte del código recorre. Los porcentajes no se suman: unas pruebas cubren partes que otras no.

| Pruebas | Líneas | Cubiertas | Cobertura |
|---|---|---|---|
| Backend: E2E (MySQL y Redis reales) | 2807 | 1463 | 52.1 % |
| Backend: integración de repositorios (MySQL real) | 2807 | 622 | 22.2 % |
| Backend: integración de módulos | 2807 | 1385 | 49.3 % |
| Backend: unitarias | 2807 | 1764 | 62.8 % |
| Frontend: unitarias | 33 | 33 | 100 % |

