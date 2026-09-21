import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { API_URL, WEB_PORT, WEB_URL, apiEnv } from "./e2e/env";

/**
 * Browser tests against production builds (run `npm run e2e:build` first):
 * web on :3100, API on :4100, database E2E_DATABASE_URL (migrated and reseeded
 * by e2e/prepare-db.ts before the API starts, on every run).
 * One worker, because the scenarios share one database.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "Asia/Qatar",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } }],
  webServer: [
    {
      command: "npx tsx ../e2e/prepare-db.ts && node dist/api/src/main.js",
      cwd: path.join(__dirname, "api"),
      env: apiEnv(),
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${WEB_PORT}`,
      env: { API_INTERNAL_URL: API_URL },
      url: `${WEB_URL}/en`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
