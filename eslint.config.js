import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
// import importResolverTs from 'eslint-import-resolver-typescript';
import security from 'eslint-plugin-security';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import vitest from 'eslint-plugin-vitest';
import globals from 'globals';

export default [
  // Ignore build outputs
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**'],
  },

  // Base JS + TS recommended
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Monorepo, TS, import, security, prettier-friendly base
  {
    plugins: {
      import: importPlugin,
      security,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      vitest,
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
        project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'],
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },

    settings: {
      // Teach eslint-plugin-import how to resolve TS in a monorepo
      'import/resolver': {
        typescript: {
          // uses eslint-import-resolver-typescript under the hood
          alwaysTryTypes: true,
          project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'],
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.d.ts'],
        },
      },
      react: { version: 'detect' },
    },

    rules: {
      // Your import order rule
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // security plugin recommended already via extends above
    },
  },

  // React/JSX (browser globals) for UI apps
  {
    files: ['**/*.tsx', '**/*.jsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    // react / hooks / a11y rules are enabled via plugins above; add any extras here if needed
  },

  // Vitest tests
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/testing/**'],
    ...vitest.configs.recommended, // provides vitest globals & sensible rules
    rules: {
      ...vitest.configs.recommended.rules,
      'security/detect-object-injection': 'off', // relax in test helpers
      '@typescript-eslint/no-explicit-any': 'off', // uncomment if your test utils use `any`
    },
  },
];
