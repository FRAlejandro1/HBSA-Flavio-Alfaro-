# Importación de la plantilla de personal

- Fecha: 2026-10-09
- Estado: Aceptada (implementada)

## Contexto

No existe un formato estándar para los archivos de personal que manejan los hospitales. Quienes preparan estos archivos conocen los nombres de las áreas y los cargos, pero no sus identificadores internos. Los archivos de Excel en español pueden utilizar punto y coma como separador, las cédulas pueden perder el cero inicial y las fechas pueden presentarse en distintos formatos.

## Decisión

La importación acepta archivos de Excel (.xlsx) y archivos de texto (.csv o .txt) de hasta 5 MB. El lector de texto reconoce como separadores la coma, el punto y coma y la tabulación. Las columnas se reconocen por sus encabezados habituales; por ejemplo, cédula, CI e identificación se consideran equivalentes. Si una columna no se reconoce, la persona puede asignarla manualmente.

Las áreas y los cargos se identifican por nombre, sin distinguir mayúsculas ni tildes. Si un nombre no existe en el hospital, la fila se marca con un error y no se crea un área ni un cargo automáticamente.

Primero se revisa el archivo sin guardar cambios. Solo después de la confirmación se aplica el plan en una única transacción: si una operación falla, no se guardan cambios parciales. Al aplicar, se vuelve a analizar el archivo y se comprueba su huella junto con el mapeo, las opciones y la empresa, para verificar que corresponda a lo revisado sin almacenar los datos personales entre ambos pasos.

Una celda vacía en un dato opcional no elimina el valor existente. Las personas ausentes del archivo no se dan de baja salvo que se solicite expresamente; si la cantidad de bajas previstas supera la mitad del personal activo considerado, se muestra una advertencia. Las personas que ya están dadas de baja no se reactivan mediante la importación.

## Consecuencias

- Un error al escribir el nombre de un área o cargo no crea registros duplicados ni permite aplicar una fila con referencias desconocidas.
- La importación no crea credenciales de acceso; las personas importadas no pueden iniciar sesión hasta que se les configure el acceso correspondiente.
- Cada archivo se analiza durante la revisión y nuevamente al aplicar, para validar los datos y las reglas vigentes en ese momento.
- Todavía no se admite un archivo que contenga todos los nombres en una sola columna de "nombre completo"; se requieren columnas separadas para nombres y apellidos.
