import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration (Pannaga).
 *
 * CI environment: mock wallet + Playwright route interception for API.
 * No BridgeKey extension, no MST Testnet, no real backend required.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,  // 90s: accommodates Next.js dev-mode first-compile
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
