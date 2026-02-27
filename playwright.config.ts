import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for smoke tests.
 *
 * Tests run against the Next.js dev server with DEV_AUTH_BYPASS=true so they
 * don't require a Clerk account. A live database is NOT required for smoke
 * tests that only test page rendering — API calls are intercepted.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DEV_AUTH_BYPASS: "true"
    }
  }
});
