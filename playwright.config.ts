import { defineConfig } from "playwright/test";

// Smoke tests only visit public pages and never submit forms, so they are safe to run
// against a dev server wired to the real Firebase project.
// Point at a running server with E2E_BASE_URL (e.g. http://localhost:3000); otherwise one is started on 3100.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next dev -p 3100", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
