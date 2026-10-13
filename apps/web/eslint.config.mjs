import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// ESLint 9 uses flat configuration. Keeping this beside the Next app makes
// `npm run lint --workspace=@coderank/web` a usable CI/local quality gate.
export default defineConfig([
  ...nextCoreWebVitals,
  globalIgnores(['.next/**', 'node_modules/**']),
]);
