// Conversion numerica segura. Todo el backend usa Number.parseFloat y Number.isNaN
// a traves de estas funciones, nunca conversiones sueltas.

// Solo acepta enteros o decimales con punto, sin texto extra ("12abc" no es un numero)
const FORMATO_DECIMAL = /^-?\d+(\.\d+)?$/;

// Convierte un texto en numero; devuelve null si no es un numero valido
export function parsearNumero(texto: string): number | null {
  const limpio = texto.trim();
  if (!FORMATO_DECIMAL.test(limpio)) {
    return null;
  }
  const numero = Number.parseFloat(limpio);
  return Number.isNaN(numero) ? null : numero;
}

// Redondea a una cantidad fija de decimales (los dias de vacaciones usan 2)
export function redondear(valor: number, decimales = 2): number {
  return Number.parseFloat(valor.toFixed(decimales));
}