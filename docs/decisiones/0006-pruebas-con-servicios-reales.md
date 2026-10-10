# Pruebas con MySQL y Redis reales, en bases separadas
- Fecha: 2026-10-10
- Estado: Aceptada

## Contexto
Las pruebas con datos simulados no detectan fallos del SQL, de las relaciones ni de los duplicados, que es donde más importa acertar.

## Decisión
Además de las pruebas unitarias, hay pruebas de repositorios y de la aplicación completa que usan MySQL y Redis reales. Esas pruebas leen sus propios datos de conexión, nunca los del desarrollo o la producción, y solo borran una base cuyo nombre termina en "_test". Se ejecutan por separado de las rápidas para no frenar el trabajo diario.

## Consecuencias
- Los errores de SQL se detectan antes de llegar al servidor.
- Para correrlas hace falta tener MySQL y Redis levantados.