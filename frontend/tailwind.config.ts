// Tema de Tailwind: todos los colores salen de variables CSS (styles/index.css),
// asi cambiar de tema (claro, oscuro, alto contraste) no toca ningun componente.
import type { Config } from 'tailwindcss';

// Variable de color en formato "R G B", para que Tailwind permita transparencias (bg-primario/50)
const color = (variable: string): string => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // El modo oscuro se activa con data-tema="oscuro" en <html>
  darkMode: ['selector', "[data-tema='oscuro']"],
  theme: {
    extend: {
      colors: {
        fondo: color('--color-fondo'),
        superficie: color('--color-superficie'),
        texto: color('--color-texto'),
        'texto-suave': color('--color-texto-suave'),
        borde: color('--color-borde'),
        primario: color('--color-primario'),
        'primario-texto': color('--color-primario-texto'),
        error: color('--color-error'),
        exito: color('--color-exito'),
        aviso: color('--color-aviso'),
        foco: color('--color-foco'),
      },
    },
  },
  plugins: [],
} satisfies Config;