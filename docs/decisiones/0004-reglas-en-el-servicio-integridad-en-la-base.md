# Las reglas de negocio viven en el servicio; la base garantiza la integridad
- Fecha: 2026-10-08
- Estado: Aceptada

## Contexto
Repartir reglas entre el código y la base de datos hace que se contradigan y que cueste saber dónde está cada una.

## Decisión
Las reglas de negocio (permisos, saldos, estados de las solicitudes) están en la capa de servicio. La base de datos solo garantiza lo que ella sola puede garantizar: relaciones, valores únicos, valores permitidos, cálculos derivados y una bitácora que no se puede modificar. El único caso con triggers es esa bitácora.

## Consecuencias
- Cada regla tiene un solo lugar donde buscarla y probarla.
- Cambiar de motor de base de datos solo toca la conexión y los repositorios.