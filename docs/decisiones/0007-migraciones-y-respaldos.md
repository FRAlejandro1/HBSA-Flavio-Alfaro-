# Migraciones y respaldos que funcionan sin Docker
- Fecha: 2026-10-10
- Estado: Aceptada

## Contexto
El sistema se instalará en un servidor propio del hospital, y los datos de personal no se pueden perder ni migrar sin una copia previa.

## Decisión
Un solo comando aplica las migraciones en desarrollo, pruebas y producción, y recuerda cuáles ya se aplicaron. En producción se usa un usuario de base de datos con permisos de estructura distinto del que usa la aplicación, y nunca se cargan los datos de demostración. Antes de migrar siempre se hace un respaldo, y si el respaldo falla no se migra. El flujo de integración continua comprueba en cada cambio que un respaldo se puede restaurar.

## Consecuencias
- Un respaldo que no se puede restaurar se detecta antes de necesitarlo.
- Los respaldos contienen datos personales y deben guardarse cifrados y fuera del servidor.