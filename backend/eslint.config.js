// Reglas de ESLint del backend: TypeScript estricto con chequeo de tipos
const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  // Carpetas y archivos que no se analizan
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.js'] },

  // Base recomendada de JavaScript y de TypeScript con tipos
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // Usa el tsconfig.json para conocer los tipos de cada archivo
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Prohibido any: los tipos se declaran en las fronteras entre capas
      '@typescript-eslint/no-explicit-any': 'error',
      // Las promesas siempre se esperan o se manejan
      '@typescript-eslint/no-floating-promises': 'error',
      // Los imports que solo son tipos se marcan como tales
      '@typescript-eslint/consistent-type-imports': 'error',
      // Variables sin uso: error, salvo las que empiezan con guion bajo
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Todo se registra con el logger de Winston, no con console
      'no-console': 'warn',
      // Comparaciones estrictas siempre
      eqeqeq: ['error', 'always'],
    },
  },
);