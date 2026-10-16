# Sesiones de corta duración, cookie segura y revocación
- Fecha: 2026-10-09
- Estado: Aceptada

## Contexto
Hay que proteger sesiones de personas con acceso a datos de personal, y poder cerrarlas de inmediato si alguien se da de baja o cambia de clave.

## Decisión
Al iniciar sesión se entregan dos credenciales. La de acceso dura 15 minutos y vive solo en la memoria de la página. La de renovación dura 7 días y viaja únicamente en una cookie que el navegador no deja leer a los scripts. Cada renovación entrega una credencial nueva, y reutilizar una ya usada cierra la sesión completa. Cerrar sesión deja la credencial de acceso en una lista de revocadas en Redis. Las acciones que cambian datos exigen además una marca contra ataques desde otros sitios.

## Consecuencias
- Robar la credencial de renovación desde un script de la página no es posible.
- Si se da de baja a alguien, su credencial de acceso puede seguir válida hasta 15 minutos.
- Si Redis no responde, las rutas protegidas fallan en lugar de aceptar una credencial que podría estar revocada.
- Hay una sola sesión activa por persona.