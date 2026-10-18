# Decisiones técnicas

Las decisiones importantes del proyecto, con su motivo y sus consecuencias. Se escriben a mano en la carpeta de decisiones del repositorio y esta página las reúne.

| Decisión | Fecha | Estado |
|---|---|---|
| TypeScript estricto en todo el proyecto | 2026-10-08 | Aceptada |
| Cada hospital es una empresa aislada | 2026-10-08 | Aceptada |
| Sesiones de corta duración, cookie segura y revocación | 2026-10-09 | Aceptada |
| Las reglas de negocio viven en el servicio; la base garantiza la integridad | 2026-10-08 | Aceptada |
| Quién puede gestionar al personal | 2026-10-09 | Aceptada |
| Pruebas con MySQL y Redis reales, en bases separadas | 2026-10-10 | Aceptada |
| Migraciones y respaldos que funcionan sin Docker | 2026-10-10 | Aceptada |
| Aprobación de vacaciones en dos pasos | 2026-10-09 | Aceptada (se implementa en el Sprint 2) |
| Importación de la plantilla de personal | 2026-10-09 | Aceptada (implementada) |
| Fechas y horas: los instantes en UTC y las fechas de calendario por zona del hospital | 2026-10-10 | Aceptada |

## TypeScript estricto en todo el proyecto

- Fecha: 2026-10-08
- Estado: Aceptada

### Contexto
El sistema maneja datos de personal y reglas de vacaciones. Un error de tipos puede dar un resultado incorrecto sin que nadie lo note hasta que alguien pierde días de vacaciones.

### Decisión
El backend y el frontend usan TypeScript en modo estricto, sin el tipo "any". Los tipos de las entradas se obtienen de los mismos esquemas que las validan, así la validación y el tipo nunca se contradicen.

### Consecuencias
- Muchos errores aparecen al compilar y no en producción.
- Arrancar es algo más lento y pide más configuración.
- El frontend mantiene sus propios tipos según lo que responde el backend. Un paquete de tipos compartido se evaluará más adelante.

## Cada hospital es una empresa aislada

- Fecha: 2026-10-08
- Estado: Aceptada

### Contexto
El sistema lo usarán varios hospitales y cada uno debe ver únicamente sus datos. Los hospitales pertenecen a una dirección provincial, que a su vez pertenece a una zona.

### Decisión
Cada hospital es una "empresa". Toda tabla con datos de negocio guarda a qué empresa pertenece, y la base de datos impide relacionar datos de hospitales distintos. El hospital de cada petición sale siempre de la sesión de quien la hace, nunca de lo que envíe el navegador. Zonas, direcciones provinciales y hospitales están en tablas separadas.

### Consecuencias
- Un error de programación difícilmente puede mostrar datos de otro hospital.
- Crear un hospital nuevo se hace por fuera de la aplicación.
- Ningún rol puede ver más de un hospital.

## Sesiones de corta duración, cookie segura y revocación

- Fecha: 2026-10-09
- Estado: Aceptada

### Contexto
Hay que proteger sesiones de personas con acceso a datos de personal, y poder cerrarlas de inmediato si alguien se da de baja o cambia de clave.

### Decisión
Al iniciar sesión se entregan dos credenciales. La de acceso dura 15 minutos y vive solo en la memoria de la página. La de renovación dura 7 días y viaja únicamente en una cookie que el navegador no deja leer a los scripts. Cada renovación entrega una credencial nueva, y reutilizar una ya usada cierra la sesión completa. Cerrar sesión deja la credencial de acceso en una lista de revocadas en Redis. Las acciones que cambian datos exigen además una marca contra ataques desde otros sitios.

### Consecuencias
- Robar la credencial de renovación desde un script de la página no es posible.
- Si se da de baja a alguien, su credencial de acceso puede seguir válida hasta 15 minutos.
- Si Redis no responde, las rutas protegidas fallan en lugar de aceptar una credencial que podría estar revocada.
- Hay una sola sesión activa por persona.

## Las reglas de negocio viven en el servicio; la base garantiza la integridad

- Fecha: 2026-10-08
- Estado: Aceptada

### Contexto
Repartir reglas entre el código y la base de datos hace que se contradigan y que cueste saber dónde está cada una.

### Decisión
Las reglas de negocio (permisos, saldos, estados de las solicitudes) están en la capa de servicio. La base de datos solo garantiza lo que ella sola puede garantizar: relaciones, valores únicos, valores permitidos, cálculos derivados y una bitácora que no se puede modificar. El único caso con triggers es esa bitácora.

### Consecuencias
- Cada regla tiene un solo lugar donde buscarla y probarla.
- Cambiar de motor de base de datos solo toca la conexión y los repositorios.

## Quién puede gestionar al personal

- Fecha: 2026-10-09
- Estado: Aceptada

### Contexto
Hay cuatro roles: administrador, Talento Humano, jefe de área y empleado. Crear cuentas y cambiar roles es una operación delicada.

### Decisión
Solo el administrador y Talento Humano gestionan al personal. El administrador puede asignar cualquier rol; Talento Humano solo puede asignar jefe de área y empleado, y no puede modificar a un administrador ni a otra persona de Talento Humano. Los cargos los administran ambos; las áreas, solo el administrador. Nadie puede darse de baja a sí mismo. Nadie se borra: se da de baja, porque las solicitudes y los documentos dependen de ese registro.

### Consecuencias
- Un empleado o un jefe no puede darse más permisos.
- Los jefes verán a su gente desde el calendario y la bandeja de solicitudes, con los datos que necesitan, no con la ficha completa.

## Pruebas con MySQL y Redis reales, en bases separadas

- Fecha: 2026-10-10
- Estado: Aceptada

### Contexto
Las pruebas con datos simulados no detectan fallos del SQL, de las relaciones ni de los duplicados, que es donde más importa acertar.

### Decisión
Además de las pruebas unitarias, hay pruebas de repositorios y de la aplicación completa que usan MySQL y Redis reales. Esas pruebas leen sus propios datos de conexión, nunca los del desarrollo o la producción, y solo borran una base cuyo nombre termina en "_test". Se ejecutan por separado de las rápidas para no frenar el trabajo diario.

### Consecuencias
- Los errores de SQL se detectan antes de llegar al servidor.
- Para correrlas hace falta tener MySQL y Redis levantados.

## Migraciones y respaldos que funcionan sin Docker

- Fecha: 2026-10-10
- Estado: Aceptada

### Contexto
El sistema se instalará en un servidor propio del hospital, y los datos de personal no se pueden perder ni migrar sin una copia previa.

### Decisión
Un solo comando aplica las migraciones en desarrollo, pruebas y producción, y recuerda cuáles ya se aplicaron. En producción se usa un usuario de base de datos con permisos de estructura distinto del que usa la aplicación, y nunca se cargan los datos de demostración. Antes de migrar siempre se hace un respaldo, y si el respaldo falla no se migra. El flujo de integración continua comprueba en cada cambio que un respaldo se puede restaurar.

### Consecuencias
- Un respaldo que no se puede restaurar se detecta antes de necesitarlo.
- Los respaldos contienen datos personales y deben guardarse cifrados y fuera del servidor.

## Aprobación de vacaciones en dos pasos

- Fecha: 2026-10-09
- Estado: Aceptada (se implementa en el Sprint 2)

### Contexto
El formulario actual de vacaciones lleva el visto bueno del jefe inmediato y la aprobación de la autoridad de la unidad. Las vacaciones no programadas se descuentan del saldo pero se tratan como una variación aparte. Talento Humano solo recibe el documento final para registrarlo.

### Decisión
Una solicitud pasa por tres estados: pendiente, con visto bueno del jefe inmediato y autorizada por el jefe de área. Cualquiera de los dos jefes puede negarla o cancelarla. Al autorizarse se descuentan los días del período más antiguo primero, se avisa a quien la pidió y se genera el documento para Talento Humano.

### Consecuencias
- La fecha y la hora de la solicitud las pone siempre el servidor.
- Lo que Talento Humano firmaba en papel ya no se hace dentro del sistema.

## Importación de la plantilla de personal

- Fecha: 2026-10-09
- Estado: Aceptada (implementada)

### Contexto

No existe un formato estándar para los archivos de personal que manejan los hospitales. Quienes preparan estos archivos conocen los nombres de las áreas y los cargos, pero no sus identificadores internos. Los archivos de Excel en español pueden utilizar punto y coma como separador, las cédulas pueden perder el cero inicial y las fechas pueden presentarse en distintos formatos.

### Decisión

La importación acepta archivos de Excel (.xlsx) y archivos de texto (.csv o .txt) de hasta 5 MB. El lector de texto reconoce como separadores la coma, el punto y coma y la tabulación. Las columnas se reconocen por sus encabezados habituales; por ejemplo, cédula, CI e identificación se consideran equivalentes. Si una columna no se reconoce, la persona puede asignarla manualmente.

Las áreas y los cargos se identifican por nombre, sin distinguir mayúsculas ni tildes. Si un nombre no existe en el hospital, la fila se marca con un error y no se crea un área ni un cargo automáticamente.

Primero se revisa el archivo sin guardar cambios. Solo después de la confirmación se aplica el plan en una única transacción: si una operación falla, no se guardan cambios parciales. Al aplicar, se vuelve a analizar el archivo y se comprueba su huella junto con el mapeo, las opciones y la empresa, para verificar que corresponda a lo revisado sin almacenar los datos personales entre ambos pasos.

Una celda vacía en un dato opcional no elimina el valor existente. Las personas ausentes del archivo no se dan de baja salvo que se solicite expresamente; si la cantidad de bajas previstas supera la mitad del personal activo considerado, se muestra una advertencia. Las personas que ya están dadas de baja no se reactivan mediante la importación.

### Consecuencias

- Un error al escribir el nombre de un área o cargo no crea registros duplicados ni permite aplicar una fila con referencias desconocidas.
- La importación no crea credenciales de acceso; las personas importadas no pueden iniciar sesión hasta que se les configure el acceso correspondiente.
- Cada archivo se analiza durante la revisión y nuevamente al aplicar, para validar los datos y las reglas vigentes en ese momento.
- Todavía no se admite un archivo que contenga todos los nombres en una sola columna de "nombre completo"; se requieren columnas separadas para nombres y apellidos.

## Fechas y horas: los instantes en UTC y las fechas de calendario por zona del hospital

- Fecha: 2026-10-10
- Estado: Aceptada

### Contexto
El sistema registra cuándo ocurre cada cosa (una solicitud, una autorización, el envío de un documento) y también fechas que se cuentan por días (el inicio de unas vacaciones, el ingreso de una persona). Si las horas se guardaran en hora de Ecuador, una operación hecha desde otro país o un servidor en otra zona daría horas que no coinciden.

### Decisión
Todo instante se guarda en UTC y la API lo entrega con la marca de UTC; la pantalla lo muestra en hora de Ecuador. Las fechas de calendario no tienen hora y no se convierten. La regla de las vacaciones programadas (siete días o más de anticipación) se mide en días de calendario del hospital, por eso cada solicitud guarda su propia fecha de calendario, calculada con la zona horaria del negocio, que se configura en una variable de entorno. La base de datos y su conexión trabajan siempre en UTC.

### Consecuencias
- Una solicitud hecha por la noche en Ecuador cuenta con el día correcto, aunque en UTC ya sea el día siguiente.
- Cambiar la zona del negocio no altera ninguna hora ya guardada.
- Los hospitales de una zona con otro huso horario necesitarán su propia zona configurada, porque hoy hay una sola por instalación.

