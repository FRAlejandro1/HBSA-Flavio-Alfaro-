# Aprobación de vacaciones en dos pasos
- Fecha: 2026-10-09
- Estado: Aceptada (se implementa en el Sprint 2)

## Contexto
El formulario actual de vacaciones lleva el visto bueno del jefe inmediato y la aprobación de la autoridad de la unidad. Las vacaciones no programadas se descuentan del saldo pero se tratan como una variación aparte. Talento Humano solo recibe el documento final para registrarlo.

## Decisión
Una solicitud pasa por tres estados: pendiente, con visto bueno del jefe inmediato y autorizada por el jefe de área. Cualquiera de los dos jefes puede negarla o cancelarla. Al autorizarse se descuentan los días del período más antiguo primero, se avisa a quien la pidió y se genera el documento para Talento Humano.

## Consecuencias
- La fecha y la hora de la solicitud las pone siempre el servidor.
- Lo que Talento Humano firmaba en papel ya no se hace dentro del sistema.