# Arquitectura del sistema

El sistema es un monorepo con tres partes: el backend (la API), el frontend (la aplicación web) y la base de datos. Cada hospital es una empresa que solo ve sus propios datos.

Este documento se genera solo a partir del código: describe lo que existe hoy tomando el comentario de encabezado de cada archivo.

## Backend: módulos de dominio

Cada módulo sigue las mismas capas: rutas, controlador, servicio, repositorio, validaciones y dominio. El servicio concentra las reglas de negocio y el repositorio es el único que habla con la base de datos.

### Auth

- **Controlador** (auth.controller.ts): Traduce HTTP a llamadas del service: lee la peticion, invoca y responde. No contiene reglas de negocio. Maneja las cookies: el refresh token solo viaja en una cookie httpOnly y nunca en el cuerpo.
- **Dominio** (auth.dominio.ts): Tipos y constantes del dominio de autenticacion. No dependen de Express ni de la base de datos.
- **Composición** (auth.modulo.ts): Composicion del modulo: conecta las implementaciones reales (MySQL, Redis, Argon2, jose) y devuelve el router listo para montar en app.ts. Es el unico lugar que las conoce.
- **Repositorio** (auth.repository.ts): Acceso a datos de autenticacion. Solo SQL parametrizado, sin reglas de negocio. El service depende de IAuthRepository, no de esta clase.
- **Rutas** (auth.routes.ts): Define los endpoints de autenticacion y encadena sus middlewares. Sin logica. El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
- **Servicio** (auth.service.ts): Reglas de negocio de la autenticacion: login, rotacion del refresh, cierre de sesion y perfil. Todas las dependencias entran por el constructor, asi el service se prueba sin base de datos ni Redis.
- **Validaciones** (auth.validators.ts): Esquemas Zod de la entrada de autenticacion. Zod limpia los datos antes de que lleguen al service.

### Importacion

- **importacion.analisis.ts**: Analisis de una plantilla de personal: reconoce las columnas, valida cada fila contra los datos del hospital y arma el plan de cambios. Es codigo puro (sin base de datos ni archivos), por eso se prueba con tablas en memoria.
- **Controlador** (importacion.controller.ts): Traduce HTTP a llamadas del service. El hospital sale del token y el archivo llega en memoria (multer). Sin reglas de negocio.
- **Dominio** (importacion.dominio.ts): Tipos, campos y sinonimos del dominio de importacion de personal. No dependen de Express ni de MySQL.
- **Composición** (importacion.modulo.ts): Composicion del modulo: conecta la base de datos real y devuelve el router listo para montar en app.ts.
- **Repositorio** (importacion.repository.ts): Acceso a datos de la importacion de personal: catalogos y personas del hospital, y aplicacion del plan en una sola transaccion (si algo falla, no se guarda nada). Solo SQL parametrizado y siempre por empresa_id.
- **Rutas** (importacion.routes.ts): Endpoints de la importacion de personal. Reciben un archivo (multipart) con tope de tamano y lo dejan en memoria; los errores de multer se traducen al formato de errores de la API. Sin logica.
- **Servicio** (importacion.service.ts): Reglas de la importacion de personal: lee el archivo, lo analiza contra los datos del hospital y, solo si se confirma con la huella de la revision, aplica el plan en una sola transaccion. La huella prueba que se envia el mismo archivo y las mismas opciones que se revisaron; no se guarda nada entre la revision y la aplicacion porque son datos personales.
- **Validaciones** (importacion.validators.ts): Esquemas Zod de los campos de texto que acompanan al archivo (multipart/form-data).

### Organizacion

- **Controlador** (organizacion.controller.ts): Traduce HTTP a llamadas del service. El hospital sale siempre del token (obtenerEmpresaId), nunca del cuerpo, la query o la URL. Sin reglas de negocio.
- **Dominio** (organizacion.dominio.ts): Tipos del dominio de organizacion: areas, procesos y cargos de un hospital. No dependen de Express ni de MySQL.
- **Composición** (organizacion.modulo.ts): Composicion del modulo: conecta la base de datos real y devuelve el router listo para montar en app.ts.
- **Repositorio** (organizacion.repository.ts): Acceso a datos de areas, procesos y cargos. Solo SQL parametrizado y siempre filtrado por empresa_id (los procesos son un catalogo global y no llevan empresa_id). El service depende de IOrganizacionRepository, no de esta clase.
- **Rutas** (organizacion.routes.ts): Endpoints de organizacion y los roles que pueden usar cada uno. Sin logica. El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
- **Servicio** (organizacion.service.ts): Reglas de negocio de areas y cargos: existencia dentro del hospital, proceso y arbol de areas, respuestas completas. Las restricciones de la base (nombres unicos, registros en uso) las traduce el repository.
- **Validaciones** (organizacion.validators.ts): Esquemas Zod de la entrada de organizacion. Son estrictos: un campo desconocido (por ejemplo empresaId) se rechaza, asi nadie puede intentar escribir en otro hospital.

### Usuarios

- **Controlador** (usuarios.controller.ts): Traduce HTTP a llamadas del service. El hospital sale siempre del token (obtenerEmpresaId), nunca del cuerpo, la query o la URL. Sin reglas de negocio.
- **Dominio** (usuarios.dominio.ts): Tipos y reglas de permisos del dominio de usuarios. No dependen de Express ni de MySQL.
- **Composición** (usuarios.modulo.ts): Composicion del modulo: conecta la base de datos y Argon2 reales y devuelve el router para app.ts.
- **Repositorio** (usuarios.repository.ts): Acceso a datos de usuarios. Solo SQL parametrizado y siempre filtrado por empresa_id. El service depende de IUsuariosRepository, no de esta clase.
- **Rutas** (usuarios.routes.ts): Endpoints de usuarios y los roles que pueden usarlos. Sin logica. El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
- **Servicio** (usuarios.service.ts): Reglas de negocio de usuarios: permisos por rol, coherencia entre correo y cuenta, bajas y reactivaciones. Las restricciones de la base (cedula y correo unicos, referencias del mismo hospital) las traduce el repository.
- **Validaciones** (usuarios.validators.ts): Esquemas Zod de la entrada de usuarios. Son estrictos: un campo desconocido (por ejemplo empresaId) se rechaza, asi nadie puede intentar escribir en otro hospital.

### Vacaciones

- **Controlador** (vacaciones.configuracion.controller.ts): Traduce HTTP a llamadas del service de configuracion. El hospital y quien cambia salen siempre del token, nunca del cuerpo, la query o la URL. Sin reglas de negocio.
- **Rutas** (vacaciones.configuracion.routes.ts): Endpoints de configuracion de dias de vacaciones: solo el SUPERADMIN. Sin logica. El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
- **Validaciones** (vacaciones.configuracion.validators.ts): Esquema Zod de la configuracion de dias de vacaciones. Es estricto: un campo desconocido se rechaza.
- **Controlador** (vacaciones.controller.ts): Traduce HTTP a llamadas del service. La persona y su hospital salen siempre del token (req.usuario), nunca del cuerpo, la query o la URL. Sin reglas de negocio.
- **vacaciones.controller.utils.ts**: Sin descripción.
- **Dominio** (vacaciones.dominio.ts): Tipos y constantes del dominio de vacaciones: solicitudes, pasos de aprobacion y sus estados. No dependen de Express ni de MySQL.
- **Composición** (vacaciones.modulo.ts): Composición del módulo: conecta la base de datos real y devuelve el router junto con el servicio. Agrupa las solicitudes de vacaciones y la configuración de días, exclusiva de SUPERADMIN.
- **Repositorio** (vacaciones.periodos.repository.ts): Acceso a datos de los periodos de vacaciones y de los dias que da cada area o persona. Solo SQL parametrizado y siempre filtrado por empresa_id. El service depende de IPeriodosRepository, no de esta clase.
- **Servicio** (vacaciones.periodos.service.ts): Periodos de vacaciones y dias que da cada area o persona: crea los periodos que faltan y deja que el SUPERADMIN cambie los dias. Las restricciones de la base las traduce el repository.
- **vacaciones.periodos.ts**: Calculo de los periodos de vacaciones de una persona: uno por cada anio de servicio, contado desde su fecha de ingreso. Es una funcion pura: no toca la base ni el reloj, asi se prueba con fechas fijas.
- **Repositorio** (vacaciones.repository.ts): Acceso a datos de vacaciones. Solo SQL parametrizado y siempre filtrado por empresa_id. El service depende de IVacacionesRepository, no de esta clase.
- **Rutas** (vacaciones.routes.ts): Endpoints de vacaciones y quien puede usar cada uno. Sin logica. El CSRF de los metodos que cambian estado lo aplica app.ts a toda la API.
- **Servicio** (vacaciones.service.ts): Reglas de negocio de las solicitudes de vacaciones: fechas, tipo, dias laborables, saldo, ruta de aprobacion, decisiones de quien aprueba y quien puede ver cada solicitud. Las restricciones de la base las traduce el repository.
- **Validaciones** (vacaciones.validators.ts): Esquemas Zod de la entrada de vacaciones. Son estrictos: un campo desconocido (por ejemplo empresaId, usuarioId, estado o la fecha de la solicitud) se rechaza, porque los pone el servidor.

## Backend: middlewares

Pasos que recorre cada petición antes de llegar al módulo: seguridad, sesión, permisos, validación y errores.

- **authenticate.ts**: Verifica el token de acceso (cabecera Authorization: Bearer ...), comprueba que no este revocado en Redis y deja el usuario en req.usuario. Las rutas protegidas lo usan antes que cualquier otro middleware.
- **authorizeRole.ts**: Filtrado por rol: deja pasar solo a los roles indicados. Va despues de authenticate.
- **csrf.ts**: Proteccion CSRF por doble envio: el token viaja en una cookie y debe repetirse en la cabecera X-CSRF-Token. Un sitio atacante puede hacer que el navegador envie la cookie, pero no puede leerla para copiarla en la cabecera. Solo se exige en metodos que cambian estado.
- **errorHandler.ts**: Respuesta uniforme de errores: traduce AppError, errores de Zod y JSON invalido a { codigo, mensaje, detalles? }. Cualquier otro error responde 500 sin filtrar datos internos.
- **multitenant.ts**: Aislamiento por hospital: toma el empresa_id del token y lo deja en req.empresaId. Controllers y services lo leen con obtenerEmpresaId; nunca aceptan un empresa_id del body, query o URL.
- **validate.ts**: Aplica esquemas Zod a body, query y params. Si algo no cumple, Zod lanza un error que errorHandler convierte en 400 con el detalle por campo. Si cumple, deja en la peticion los valores ya limpios y convertidos (recortados, numeros reales, valores por defecto).

## Backend: configuración

Conexiones y políticas globales. Cambiar de motor de base de datos solo toca la conexión.

- **cors.ts**: Politica CORS centralizada: solo los origenes de CORS_ORIGINS pueden llamar a la API con cookies.
- **database.ts**: Unico punto de acceso a la base de datos. El resto del sistema (repositories) depende de IBaseDatos, nunca de mysql2: para cambiar de motor solo se implementa esta interfaz y se ajusta la fabrica.
- **env.ts**: Carga y valida las variables de entorno con Zod al arrancar. Si falta o es invalida alguna, el proceso falla de inmediato con un mensaje claro. Ningun otro archivo lee process.env: todo pasa por el objeto "env" de aqui.
- **helmet.ts**: Cabeceras de seguridad con Helmet: CSP, HSTS y Trusted Types. La API solo devuelve JSON, asi que la CSP es cerrada por completo; la CSP de la SPA se define en el servidor que sirve el frontend.
- **logger.ts**: Logger estructurado con Winston: una linea JSON por evento, apta para diagnostico y auditoria. En pruebas se silencia para no ensuciar la salida.
- **rateLimit.ts**: Limites de peticiones por ruta, con Redis o memoria segun se defina mas adelante. Hoy usan memoria del proceso: suficiente para una sola instancia.
- **redis.ts**: Cliente de Redis para la sesion: blacklist de jti y datos temporales. Nunca se guardan aqui datos sensibles.

## Backend: piezas compartidas

Herramientas que usan varios módulos: errores, seguridad, tipos y utilidades.

- **errors/AppError.ts**: Errores de dominio tipados. Los services lanzan AppError y solo errorHandler los traduce a una respuesta HTTP: ninguna otra capa conoce codigos de estado.
- **errors/errorBD.ts**: Traduce los errores de la base de datos que el usuario puede provocar (duplicados, registros en uso, referencias invalidas) a AppError. Lo usan los repositories, que son los unicos que conocen el motor.
- **http/peticion.ts**: Utilidades para leer datos de la peticion que comparten los controllers.
- **security/password.ts**: Hash y verificacion de claves con Argon2id (parametros minimos recomendados por OWASP: 19 MiB de memoria, 2 iteraciones, 1 hilo). La sal es aleatoria y va dentro del propio hash.
- **security/sesionStore.ts**: Lista de tokens revocados en Redis. Cada jti revocado vive solo hasta que el token habria expirado de todas formas, asi la lista no crece sin limite. Si Redis no responde, la peticion falla: es preferible a dejar pasar un token que podria estar revocado.
- **security/tokens.ts**: Firma y verificacion de JWT con jose (HS256): token de acceso (corto, viaja en la cabecera) y token de refresh (largo, viaja solo en cookie httpOnly). Cada uno usa su propio secreto.
- **types/autenticacion.ts**: Datos del usuario que viajan en el token de acceso y que el middleware authenticate deja en req.usuario.
- **types/express.d.ts**: Amplia la peticion de Express con los datos que agregan los middlewares de autenticacion.
- **types/roles.ts**: Roles del sistema. Los codigos coinciden con roles.codigo en la base de datos.
- **utils/duraciones.ts**: Convierte duraciones como "15m" o "7d" (las de JWT_ACCESS_TTL y JWT_REFRESH_TTL) en segundos.
- **utils/fechas.ts**: Fechas y dias laborables. Las fechas viajan como texto "AAAA-MM-DD" y los calculos se hacen en UTC, asi la zona horaria del servidor nunca cambia el resultado.
- **utils/numeros.ts**: Conversion numerica segura. Todo el backend usa Number.parseFloat y Number.isNaN a traves de estas funciones, nunca conversiones sueltas.
- **utils/texto.ts**: Normalizacion de texto para comparar nombres sin importar tildes, mayusculas ni espacios.
- **utils/zonaHoraria.ts**: Fechas de calendario en la zona horaria del negocio. El servidor y la base trabajan en UTC; cuando una regla se cuenta por dias de calendario (la solicitud es programada si faltan 7 dias o mas), el "dia" es el de la zona del hospital, no el de UTC.
- **validators/comunes.ts**: Esquemas Zod reutilizables por varios modulos.

## Backend: comandos

Programas que se ejecutan desde la terminal, como la migración de la base de datos.

- **crearSuperadmin.ts**: Crea el primer SUPERADMIN de un hospital (alguien debe poder entrar antes de que existan usuarios). Los datos llegan por variables de entorno para no quedar en archivos; la clave se guarda con Argon2id. Uso: ver "crear-superadmin" en package.json y la seccion de comandos del README.
- **documentacion/analizadores.ts**: Analizadores puros de la documentacion automatica: reciben texto y devuelven datos. No leen archivos ni ejecutan comandos, por eso se prueban sin preparar nada.
- **documentacion/generadores.ts**: Generadores de documentacion: leen el repositorio y arman archivos Markdown en lenguaje sencillo, sin codigo. La fuente de cada dato es el propio proyecto: comentarios de encabezado, migraciones, rutas, commits, decisiones tecnicas y reportes de cobertura. Si el codigo cambia, la documentacion cambia con el.
- **documentacion/index.ts**: Comando que genera la documentacion del sistema en archivos Markdown, sin codigo, leyendo el repositorio. Uso: npm run docs:generar -w backend -- [--salida <carpeta>] [--cobertura <carpeta>] Por defecto escribe en docs/generada. Lo ejecuta el flujo de integracion continua al final de la validacion.
- **migrador.ts**: Aplica migraciones y seeds SQL sobre cualquier MySQL (desarrollo, pruebas o produccion), sin depender de Docker. Lo usan el comando "migrar" y la preparacion de las pruebas con base de datos real. Las migraciones se registran en schema_migraciones y nunca se repiten; los seeds son idempotentes.
- **migrar.ts**: Comando para migrar la base de datos: desarrollo, pruebas o produccion. Uso: npm run migrar:local -w backend -- [todo|migraciones|seeds] [--demo] [--reiniciar] En produccion: node dist/scripts/migrar.js migraciones  (y luego "seeds" para los datos base) Lee la conexion de DB_*; si existe MIGRACION_DB_USER usa ese usuario (con permisos de DDL).

