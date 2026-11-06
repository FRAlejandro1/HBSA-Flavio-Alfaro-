import type {
  IdSeccionAdmin,
  SeccionAdmin,
} from '@/features/superadmin/model/superadmin.types';

const ROLES = [
  'Superadministrador',
  'Talento Humano',
  'Jefe de área',
  'Empleado',
] as const;

// Procesos en los que se clasifica la estructura organizativa del MSP
const PROCESOS = [
  'Gobernante',
  'Agregadores de valor',
  'Habilitantes de asesoría',
  'Habilitantes de apoyo',
] as const;

export const SECCIONES_ADMIN: readonly SeccionAdmin[] = [
  {
    id: 'cuentas',
    titulo: 'Cuentas de personal',
    descripcion: 'Modificar o eliminar las cuentas de empleados y jefes.',
    icono: '◉',
    conectada: false,
    detalle: {
      buscador: 'Buscar por nombre, cédula o correo',
      filtros: [
        {
          id: 'rol',
          etiqueta: 'Rol',
          tipo: 'seleccion',
          opciones: ['Todos', ...ROLES],
        },
        {
          id: 'estado',
          etiqueta: 'Estado',
          tipo: 'seleccion',
          opciones: ['Todos', 'Activa', 'Inactiva'],
        },
      ],
      acciones: ['+ Nueva cuenta', 'Editar cuenta', 'Eliminar cuenta'],
      tituloTabla: 'Cuentas registradas',
      columnas: ['Nombre', 'Cédula', 'Correo', 'Rol', 'Área', 'Estado'],
    },
  },
  {
    id: 'roles',
    titulo: 'Asignar rol',
    descripcion: 'Asignar un rol, un área y un jefe inmediato a un nuevo empleado.',
    icono: '⚑',
    conectada: false,
    detalle: {
      formularioPrimero: true,
      formulario: {
        titulo: 'Asignar rol a un nuevo empleado',
        accion: 'Asignar rol',
        campos: [
          {
            id: 'persona',
            etiqueta: 'Persona (cédula o nombre)',
            tipo: 'texto',
            requerido: true,
            ayuda: 'Si la persona ya existe, sus datos se completarán solos.',
          },
          {
            id: 'rol',
            etiqueta: 'Rol',
            tipo: 'seleccion',
            opciones: ROLES,
            requerido: true,
          },
          { id: 'area', etiqueta: 'Área', tipo: 'seleccion', requerido: true },
          { id: 'cargo', etiqueta: 'Cargo', tipo: 'seleccion', requerido: true },
          { id: 'jefe', etiqueta: 'Jefe inmediato', tipo: 'seleccion' },
        ],
      },
      tituloTabla: 'Asignaciones recientes',
      columnas: ['Persona', 'Rol', 'Área', 'Asignado por', 'Fecha'],
    },
  },
  {
    id: 'estructura',
    titulo: 'Áreas y cargos',
    descripcion: 'Administrar los procesos, las áreas con sus subáreas y los cargos.',
    icono: '❖',
    conectada: false,
    detalle: {
      buscador: 'Buscar área o cargo',
      filtros: [
        {
          id: 'proceso',
          etiqueta: 'Proceso',
          tipo: 'seleccion',
          opciones: ['Todos', ...PROCESOS],
        },
        {
          id: 'tipo',
          etiqueta: 'Mostrar',
          tipo: 'seleccion',
          opciones: ['Áreas y subáreas', 'Cargos'],
        },
      ],
      acciones: ['+ Nueva área', '+ Nuevo cargo', 'Editar', 'Eliminar'],
      tituloTabla: 'Estructura organizativa',
      columnas: ['Proceso', 'Área', 'Subárea', 'Jefe de área'],
    },
  },
  {
    id: 'dias',
    titulo: 'Días de vacaciones',
    descripcion: 'Cambiar los días por período de un área o de una persona.',
    icono: '◷',
    conectada: true,
  },
  {
    id: 'revertir',
    titulo: 'Revertir solicitudes',
    descripcion: 'Revertir una solicitud autorizada que se aprobó por error.',
    icono: '↺',
    conectada: false,
    detalle: {
      buscador: 'Buscar por número de trámite o nombre',
      tituloTabla: 'Solicitudes autorizadas',
      columnas: ['Orden', 'Persona', 'Fechas', 'Días', 'Autorizada el'],
      formulario: {
        titulo: 'Revertir una solicitud autorizada',
        accion: 'Revertir solicitud',
        campos: [
          {
            id: 'motivo',
            etiqueta: 'Motivo de la reversión',
            tipo: 'textarea',
            requerido: true,
            ayuda: 'Es obligatorio y queda registrado junto con la solicitud.',
          },
        ],
      },
    },
  },
];

export function buscarSeccion(id: IdSeccionAdmin): SeccionAdmin | undefined {
  return SECCIONES_ADMIN.find((seccion) => seccion.id === id);
}