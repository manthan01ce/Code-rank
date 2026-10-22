import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const path = (value) => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
  testDir: ".",
  testMatch: process.env.BROWSER_PERFORMANCE === "true" ? "**/auth-performance.spec.mjs" : "**/role-workflows.spec.mjs",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: path("../../test-results/browser/"),
  reporter: [
    ["list"],
    ["json", { outputFile: path("../../test-results/browser-results.json") }],
    [
      "html",
      {
        outputFolder: path("../../test-results/browser-report/"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: process.env.BROWSER_BASE_URL || "http://127.0.0.1:3101",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
