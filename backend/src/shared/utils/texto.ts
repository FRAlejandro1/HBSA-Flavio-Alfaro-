// Normalizacion de texto para comparar nombres sin importar tildes, mayusculas ni espacios.

// "  Consulta   EXTERNA " y "consulta externa" dan el mismo resultado; "Médico" y "medico" tambien
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Ademas quita todo lo que no sea letra o numero: "Fecha de Ingreso" y "fecha_ingreso" son lo mismo
export function normalizarEncabezado(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]/g, '');
}