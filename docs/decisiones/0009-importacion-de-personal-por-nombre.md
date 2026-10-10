# Importación de la plantilla por nombre de área y cargo
- Fecha: 2026-10-09
- Estado: Aceptada (se implementa en el siguiente lote)

## Contexto
No existe un formato estándar para los archivos de personal que manejan los hospitales, y quien los prepara conoce los nombres de las áreas y cargos, no sus números internos.

## Decisión
La importación acepta archivos de Excel y de texto separado por comas, con un lector para cada formato. Área y cargo se indican por nombre, sin distinguir mayúsculas ni tildes. Un nombre desconocido es un error de esa fila y nunca crea un área nueva. Primero se revisa todo el archivo sin guardar, y solo si la persona confirma se aplica en una única operación. Quien falta en el archivo no se da de baja automáticamente.

## Consecuencias
- Un error de tipeo no crea áreas duplicadas.
- Un archivo incompleto no deja a medio hospital sin acceso.