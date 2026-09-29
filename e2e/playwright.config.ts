import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration (Pannaga).
 *
 * CI environment: mock wallet + Playwright route interception for API.
 * No BridgeKey extension, no MST Testnet, no real backend required.
 *
 * NEXT_PUBLIC_API_MODE=e2e ensures MSW service worker does NOT initialize
 * in the browser. All API responses are provided by Playwright's page.route()
 * intercepts instead.
 *
 * NEXT_PUBLIC_WALLET_MODE=mock ensures the mock wallet adapter is used
 * without requiring the BridgeKey browser extension.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,  // 90s: accommodates Next.js dev-mode first-compile
  expect: { timeout: 15_000 }, // 15s assertion timeout: handles first-compile latency
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
