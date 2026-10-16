// Reglas de ESLint del frontend: TypeScript estricto con chequeo de tipos, hooks de React y accesibilidad
import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Carpetas y archivos que no se analizan
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.js', 'postcss.config.js'],
  },

  // Base recomendada de JavaScript y de TypeScript con tipos
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Accesibilidad en JSX (roles ARIA, etiquetas, teclado)
  jsxA11y.flatConfigs.recommended,

  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // Usa el tsconfig.json para conocer los tipos de cada archivo
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Reglas de hooks: orden correcto y dependencias completas
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Prohibido any: los tipos se declaran en las fronteras entre capas
      '@typescript-eslint/no-explicit-any': 'error',
      // Las promesas siempre se esperan o se manejan
      '@typescript-eslint/no-floating-promises': 'error',
      // Los imports que solo son tipos se marcan como tales
      '@typescript-eslint/consistent-type-imports': 'error',
      // Variables sin uso: error, salvo las que empiezan con guion bajo
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Sin console en el codigo de la aplicacion
      'no-console': 'warn',
      // Comparaciones estrictas siempre
      eqeqeq: ['error', 'always'],
      // Regla del proyecto: nunca se inyecta HTML sin sanitizar
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Prohibido dangerouslySetInnerHTML: usa texto o Sanitizar.ts',
        },
      ],
    },
  },
);