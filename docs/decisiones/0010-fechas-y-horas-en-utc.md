# Fechas y horas: los instantes en UTC y las fechas de calendario por zona del hospital
- Fecha: 2026-10-10
- Estado: Aceptada

## Contexto
El sistema registra cuándo ocurre cada cosa (una solicitud, una autorización, el envío de un documento) y también fechas que se cuentan por días (el inicio de unas vacaciones, el ingreso de una persona). Si las horas se guardaran en hora de Ecuador, una operación hecha desde otro país o un servidor en otra zona daría horas que no coinciden.

## Decisión
Todo instante se guarda en UTC y la API lo entrega con la marca de UTC; la pantalla lo muestra en hora de Ecuador. Las fechas de calendario no tienen hora y no se convierten. La regla de las vacaciones programadas (siete días o más de anticipación) se mide en días de calendario del hospital, por eso cada solicitud guarda su propia fecha de calendario, calculada con la zona horaria del negocio, que se configura en una variable de entorno. La base de datos y su conexión trabajan siempre en UTC.

## Consecuencias
- Una solicitud hecha por la noche en Ecuador cuenta con el día correcto, aunque en UTC ya sea el día siguiente.
- Cambiar la zona del negocio no altera ninguna hora ya guardada.
- Los hospitales de una zona con otro huso horario necesitarán su propia zona configurada, porque hoy hay una sola por instalación.