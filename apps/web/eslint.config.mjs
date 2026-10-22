import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// ESLint 9 uses flat configuration. Keeping this beside the Next app makes
// `npm run lint --workspace=@coderank/web` a usable CI/local quality gate.
export default defineConfig([
  ...nextCoreWebVitals,
  {
    // These React Compiler diagnostics require a component-by-component
    // migration. Keep them visible without blocking existing production code.
    rules: {
      '@next/next/no-html-link-for-pages': ['error', fileURLToPath(new URL('./src/app', import.meta.url))],
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**']),
]);
