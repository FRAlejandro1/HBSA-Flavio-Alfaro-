# Cada hospital es una empresa aislada
- Fecha: 2026-10-08
- Estado: Aceptada

## Contexto
El sistema lo usarán varios hospitales y cada uno debe ver únicamente sus datos. Los hospitales pertenecen a una dirección provincial, que a su vez pertenece a una zona.

## Decisión
Cada hospital es una "empresa". Toda tabla con datos de negocio guarda a qué empresa pertenece, y la base de datos impide relacionar datos de hospitales distintos. El hospital de cada petición sale siempre de la sesión de quien la hace, nunca de lo que envíe el navegador. Zonas, direcciones provinciales y hospitales están en tablas separadas.

## Consecuencias
- Un error de programación difícilmente puede mostrar datos de otro hospital.
- Crear un hospital nuevo se hace por fuera de la aplicación.
- Ningún rol puede ver más de un hospital.