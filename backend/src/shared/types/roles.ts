// Roles del sistema. Los codigos coinciden con roles.codigo en la base de datos.

export const ROLES = ['SUPERADMIN', 'TALENTO_HUMANO', 'JEFE_AREA', 'EMPLEADO'] as const;

export type CodigoRol = (typeof ROLES)[number];

// Comprueba en tiempo de ejecucion que un texto sea un rol valido
export function esCodigoRol(valor: string): valor is CodigoRol {
  return (ROLES as readonly string[]).includes(valor);
}

// Convierte un texto de la base de datos en rol; un valor desconocido indica datos danados y se falla
export function aCodigoRol(valor: string): CodigoRol {
  if (!esCodigoRol(valor)) {
    throw new Error(`Rol desconocido en la base de datos: ${valor}`);
  }
  return valor;
}