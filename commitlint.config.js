// Reglas de commits del proyecto: tipo(alcance): descripcion
// Ejemplos: feat(vacaciones): agrega descuento FIFO, fix(auth): corrige el refresh
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tipos permitidos
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci'],
    ],
    // La descripcion va en espanol, asi que no se fuerza el uso de mayusculas
    'subject-case': [0],
    // Encabezado maximo de 100 caracteres
    'header-max-length': [2, 'always', 100],
  },
};