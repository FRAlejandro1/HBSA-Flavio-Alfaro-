# TypeScript estricto en todo el proyecto
- Fecha: 2026-10-08
- Estado: Aceptada

## Contexto
El sistema maneja datos de personal y reglas de vacaciones. Un error de tipos puede dar un resultado incorrecto sin que nadie lo note hasta que alguien pierde días de vacaciones.

## Decisión
El backend y el frontend usan TypeScript en modo estricto, sin el tipo "any". Los tipos de las entradas se obtienen de los mismos esquemas que las validan, así la validación y el tipo nunca se contradicen.

## Consecuencias
- Muchos errores aparecen al compilar y no en producción.
- Arrancar es algo más lento y pide más configuración.
- El frontend mantiene sus propios tipos según lo que responde el backend. Un paquete de tipos compartido se evaluará más adelante.