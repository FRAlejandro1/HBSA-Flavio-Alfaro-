# Base de datos

MySQL 8.0. Cada hospital es una empresa y todas las tablas con datos de negocio guardan a cuál pertenecen. Este documento se genera solo a partir de las migraciones.

## Migraciones

- **001_esquema_inicial.sql**: Esquema base del sistema de vacaciones hospitalarias. Multiempresa: cada "empresa" es un HOSPITAL, que filtra sus propios datos. Motor InnoDB, utf8mb4, MySQL 8.0 (ultima). Toda tabla de negocio lleva empresa_id.
- **002_triggers.sql**: Solo triggers que la BD debe garantizar por si sola.
- **003_ajustes_v3.sql**: Zonas como tabla propia, paso de visto bueno y justificacion. Se aplica sobre 001 antes de cargar datos reales.
- **004_login_por_correo.sql**: Correo unico en todo el sistema (el hospital sale del usuario), ingreso opcional (el personal importado no necesita cuenta) y fecha de baja.
- **005_horas_en_utc.sql**: Los instantes (fecha y hora de un hecho) se guardan en UTC; las fechas de calendario (inicio de vacaciones, ingreso, baja) son fechas sin hora y no cambian. La solicitud guarda ademas su fecha de calendario en la zona del negocio, calculada por el backend: de ella se deriva si la solicitud es programada, asi la regla no depende de la hora UTC.
- **006_estructura_organizativa.sql**: Clasificacion por procesos del MSP, areas con subareas (arbol) y datos del puesto. Las columnas nuevas son opcionales o con valor por defecto para no romper lo que ya inserta el backend.
- **007_flujo_aprobacion.sql**: Flujo de aprobacion configurable de vacaciones: rutas por nivel, pasos con trazabilidad, escalamiento y delegacion. Los instantes van en UTC, igual que en 005. Las columnas visto_bueno_* y resuelto_* de solicitudes_vacaciones se mantienen como snapshot del PDF.
- **008_dias_vacaciones.sql**: Dias de vacaciones por periodo, configurables por area y por persona. Manda el valor de la persona; si no tiene, el de su area; si el area no tiene, el de su area padre; y si ninguna tiene, el valor por defecto del backend (DIAS_VACACIONES_ANUALES). Solo afecta a los periodos que se creen despues: los que ya existen no cambian.

## Tablas

| Tabla | Para qué sirve | Migración |
|---|---|---|
| direcciones_provinciales | Direcciones provinciales / zonas: catalogo global (NO es tenant). Ej. Zona 4 | 001_esquema_inicial.sql |
| empresas | Empresas = hospitales: raiz del aislamiento multitenant; la direccion provincial sale de aqui | 001_esquema_inicial.sql |
| roles | Roles del sistema (catalogo global) | 001_esquema_inicial.sql |
| cargos | Cargos: concentra responsabilidad y funciones que se imprimen en la solicitud | 001_esquema_inicial.sql |
| areas | Areas / unidades del hospital (el jefe se asigna despues para evitar dependencia circular) | 001_esquema_inicial.sql |
| usuarios | Usuarios: datos personales, rol, cargo, jefe inmediato y jti del refresh token vigente | 001_esquema_inicial.sql |
| feriados | Feriados nacionales/locales: el backend los excluye al contar dias laborables | 001_esquema_inicial.sql |
| periodos_vacaciones | Periodos de vacaciones: un registro por usuario y anio de servicio (30 dias laborables) | 001_esquema_inicial.sql |
| secuencias_tramite | Contador atomico del orden de tramite por empresa y anio | 001_esquema_inicial.sql |
| solicitudes_vacaciones | Solicitudes de vacaciones (snapshot de cargo/area/saldos para trazabilidad del PDF) | 001_esquema_inicial.sql |
| solicitud_descuentos | Detalle del descuento FIFO: de que periodo salio cada dia solicitado | 001_esquema_inicial.sql |
| permisos_hora | Permisos por hora: replica el formulario de control de salida del personal | 001_esquema_inicial.sql |
| notificaciones | Notificaciones al solicitante (aprobado, negado, cancelado) | 001_esquema_inicial.sql |
| documentos_pdf | PDFs generados y su envio a Talento Humano (hash para integridad) | 001_esquema_inicial.sql |
| audit_log | Bitacora de auditoria (solo insercion) | 001_esquema_inicial.sql |
| zonas | Zonas: nivel mas alto de la jerarquia (ej. Zona 4) | 003_ajustes_v3.sql |
| procesos | Procesos institucionales: clasificacion fija de la estructura del MSP (catalogo global, NO es tenant) | 006_estructura_organizativa.sql |
| config_aprobacion | Parametros del flujo por hospital | 007_flujo_aprobacion.sql |
| rutas_aprobacion | Ruta de aprobacion segun el nivel jerarquico del solicitante: un registro por paso, en orden | 007_flujo_aprobacion.sql |
| delegaciones | Delegaciones: un usuario autoriza a otro a aprobar por el durante un periodo | 007_flujo_aprobacion.sql |
| solicitud_aprobaciones | Un escalamiento no edita el paso: lo marca ESCALADO y crea otro paso asignado al nuevo responsable | 007_flujo_aprobacion.sql |

## Relaciones entre tablas

Cada tabla depende de las que aparecen a su derecha.

- **areas** depende de: empresas, usuarios, procesos
- **cargos** depende de: empresas
- **config_aprobacion** depende de: empresas
- **delegaciones** depende de: usuarios
- **direcciones_provinciales** depende de: zonas
- **documentos_pdf** depende de: solicitudes_vacaciones
- **empresas** depende de: direcciones_provinciales
- **notificaciones** depende de: usuarios
- **periodos_vacaciones** depende de: usuarios
- **permisos_hora** depende de: usuarios, areas
- **rutas_aprobacion** depende de: empresas
- **secuencias_tramite** depende de: empresas
- **solicitud_aprobaciones** depende de: solicitudes_vacaciones, usuarios, delegaciones
- **solicitud_descuentos** depende de: solicitudes_vacaciones, periodos_vacaciones
- **solicitudes_vacaciones** depende de: usuarios, areas, cargos
- **usuarios** depende de: areas, cargos, roles

## Reglas que cumple la propia base

- **trg_audit_no_update**: Bloquea UPDATE sobre la bitacora: la auditoria es inmutable
- **trg_audit_no_delete**: Bloquea DELETE sobre la bitacora

## Datos iniciales

- **001_roles.sql**: Los 4 roles del sistema, con ids fijos para que el backend pueda referirse a ellos. Se puede ejecutar varias veces sin duplicar datos.
- **002_catalogos_base.sql**: Catalogos base del hospital para pruebas y ejecuciones sin datos demo. Idempotente: recupera los IDs existentes mediante las claves naturales.
- **002_catalogos_demo.sql** *(solo desarrollo)*: Datos de DEMOSTRACION para desarrollo: nunca se cargan en produccion. Se puede ejecutar varias veces sin duplicar datos.
- **002_estructura_areas.sql**: Estructura organizativa del hospital segun el PDF "Estructura de puestos de hospitales basicos de 30 camas o mas del MSP": areas principales por proceso y sus subareas. Se corre una sola vez por hospital, despues de 001_roles.sql y de las migraciones 001-007.
- **003_cargos_msp.sql**: Cargos del hospital segun el PDF "Estructura de puestos de hospitales basicos de 30 camas o mas del MSP": 112 puestos con su grado, rol del puesto y nivel jerarquico, mas Subdirector/a y Jefe/a de Area, que el PDF no trae pero el flujo de aprobacion necesita. Responsabilidad y funciones son textos breves por tipo de puesto; Talento Humano puede ajustarlos despues. Se corre una sola vez por hospital, despues de 002_estructura_areas.sql. Requiere MySQL 8.0.19 o superior (VALUES ROW).
- **004_flujo_aprobacion.sql**: Parametros y rutas del flujo de aprobacion de vacaciones del hospital. Se ejecuta una sola vez por hospital; las rutas se pueden cambiar despues sin tocar codigo.
