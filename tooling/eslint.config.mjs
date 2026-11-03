import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export const baseIgnores = [
  '.next/**',
  'node_modules/**',
  'dist/**',
  '.tmp/**',
  'build/**',
  '.turbo/**',
  'coverage/**',
  'out/**',
];

export const baseLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

export const baseConfig = [
  globalIgnores(baseIgnores),
  {
    languageOptions: baseLanguageOptions,
  },
];

// Scope Next.js core web vitals and React rules to apps/web files so backend packages,
// workers, and scripts are linted under shared base rules rather than inheriting Next.js config.
const webScopedNext = nextCoreWebVitals.map((config) => {
  const scoped = { ...config };
  if (scoped.files) {
    scoped.files = scoped.files.map((pattern) => (pattern.startsWith('apps/web/') ? pattern : `apps/web/${pattern}`));
  } else if (scoped.rules) {
    scoped.files = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'];
  }
  return scoped;
});

export default defineConfig([
  ...baseConfig,
  ...webScopedNext,
  {
    files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'],
    rules: {
      '@next/next/no-html-link-for-pages': ['error', fileURLToPath(new URL('../apps/web/src/app', import.meta.url))],
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]);
