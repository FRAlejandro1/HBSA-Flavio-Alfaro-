# Frontend

Aplicación web de una sola página hecha con React. Las pantallas se cargan solo cuando se necesitan y los datos se piden a la API mediante consultas con caché.

Este documento se genera solo a partir del código.

## Arranque

Punto de entrada y proveedores globales.

- **App.tsx**: Componente raiz: monta los proveedores globales y la pantalla inicial. En el Sprint 1 aqui se suman el proveedor de sesion, el de tema y las rutas.
- **main.tsx**: Punto de entrada: monta la aplicacion React dentro de #root
- **vite-env.d.ts**: Tipos de Vite y de las variables de entorno del proyecto (import.meta.env)

## Configuración

Variables globales y cliente de la API.

- **Variables.ts**: Variables globales del frontend, leidas una sola vez desde import.meta.env. Ningun otro archivo toca import.meta.env: todo pasa por el objeto Variables.

## Rutas

Navegación y protección por sesión y rol.

Todavía no hay archivos aquí.

## Hooks

Lógica reutilizable de sesión, tema y otros.

Todavía no hay archivos aquí.

## Piezas compartidas

Componentes, diseño general y utilidades que usan varias pantallas.

Todavía no hay archivos aquí.

## Módulos

Cada módulo agrupa una pantalla contenedora, sus componentes, su servicio de datos y su validación.

Todavía no hay módulos.

