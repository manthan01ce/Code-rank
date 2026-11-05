import { browserFiles } from '../../scripts/ci/test-lanes.mjs';
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Frontend request/state tests with synthetic HTTP fixtures; real authority and PDF
// acceptance remain in role-workflows.spec.mjs and the full-stack lane.
export default defineConfig({
  testDir: '.', testMatch: (await browserFiles('frontend')).map(file => '**/' + file.split('/').at(-1)), workers: 1, retries: 0,
  forbidOnly: Boolean(process.env.CI), timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/faculty-review-results.json', import.meta.url)) }]],
  use: {
    baseURL: 'http://127.0.0.1:3120', browserName: 'chromium', headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'npm run start --workspace=apps/web -- --hostname 127.0.0.1 --port 3120',
    url: 'http://127.0.0.1:3120/login', reuseExistingServer: false,
  },
});
