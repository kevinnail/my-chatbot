import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2021,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['info', 'error'] }],
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'space-in-parens': ['error'],
      'space-infix-ops': 'error',
      'object-curly-spacing': ['error', 'always'],
      'comma-spacing': 'error',
      'eol-last': ['error', 'always'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'array-bracket-spacing': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'rest-spread-spacing': 'error',
      'prefer-arrow-callback': 'error',
      'object-shorthand': ['error', 'always'],
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
];
