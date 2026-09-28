/**
 * E2E: Wallet login flow (Pannaga)
 *
 * Uses:
 *   - NEXT_PUBLIC_WALLET_MODE=mock  (mock adapter, no BridgeKey required)
 *   - Playwright page.route() to intercept API calls (no backend required)
 *
 * The test exercises the REAL application flow:
 *   Login page → Connect button → wallet.connect() → POST /auth/nonce
 *     → wallet.signMessage() → POST /auth/wallet-login → redirect to /dashboard
 *
 * It does NOT just mock the logged-in state. The full JS execution path runs.
 */
import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants matching mock-adapter.ts
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = "0xaaa1";
const MOCK_SIGNATURE = "0xmocksig_pannaga_overvault_test";
const MOCK_NONCE = "deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234deadbeefcafe1234";
const MOCK_JWT = "mock.jwt.u1.test";

// ---------------------------------------------------------------------------
// Route helpers — intercept backend calls from the browser
// ---------------------------------------------------------------------------

async function mockAuthRoutes(page: Page) {
  // Mock POST /auth/nonce
  await page.route("**/auth/nonce", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: MOCK_NONCE,
        message: `Sign in to OverVault.\n\nNonce: ${MOCK_NONCE}`,
      }),
    });
  });

  // Mock POST /auth/wallet-login
  await page.route("**/auth/wallet-login", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.continue();
    const body = JSON.parse(req.postData() ?? "{}");

    if (body.signature === MOCK_SIGNATURE) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: MOCK_JWT,
          token_type: "bearer",
        }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { code: "invalid_signature", message: "Signature mismatch" },
        }),
      });
    }
  });
}

async function mockNonceFailure(page: Page, code: string, status: number) {
  await page.route("**/auth/nonce", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code, message: code } }),
    });
  });
}

async function mockLoginFailure(page: Page, code: string, status: number) {
  await page.route("**/auth/nonce", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: MOCK_NONCE,
        message: `Sign in to OverVault.\n\nNonce: ${MOCK_NONCE}`,
      }),
    });
  });

  await page.route("**/auth/wallet-login", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code, message: code } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test("connect wallet and log in — happy path", async ({ page }) => {
  await mockAuthRoutes(page);

  // Go to login page
  await page.goto("/login");

  // Verify page loaded with the Connect button
  const connectBtn = page.locator("#connect-wallet-btn");
  await expect(connectBtn).toBeVisible();
  await expect(connectBtn).toBeEnabled();

  // Click connect — this triggers: wallet.connect() → nonce → sign → verify
  await connectBtn.click();

  // Should redirect to /dashboard after successful login (wallet flow is async)
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  expect(page.url()).toMatch(/\/dashboard/);
});

// ---------------------------------------------------------------------------
// Error: address not found (403)
// ---------------------------------------------------------------------------

test("shows address-not-found error for unregistered wallet", async ({ page }) => {
  await page.route("**/auth/nonce", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: MOCK_NONCE,
        message: `Sign in to OverVault.\n\nNonce: ${MOCK_NONCE}`,
      }),
    });
  });

  await page.route("**/auth/wallet-login", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "address_not_found" } }),
    });
  });

  await page.goto("/login");

  const connectBtn = page.locator("#connect-wallet-btn");
  await connectBtn.click();

  // Error banner must appear
  const banner = page.locator("#login-error-banner");
  await expect(banner).toBeVisible({ timeout: 8_000 });
  await expect(banner).toContainText(/not registered|address/i);

  // Button resets to idle
  await expect(connectBtn).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Error: server unavailable (nonce request fails)
// ---------------------------------------------------------------------------

test("shows error when nonce request fails", async ({ page }) => {
  await page.route("**/auth/nonce", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ status: 500, body: "Server error" });
  });

  await page.goto("/login");

  const connectBtn = page.locator("#connect-wallet-btn");
  await connectBtn.click();

  const banner = page.locator("#login-error-banner");
  await expect(banner).toBeVisible({ timeout: 8_000 });

  // Button must re-enable for retry
  await expect(connectBtn).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Error: invalid signature (401)
// ---------------------------------------------------------------------------

test("shows error on signature verification failure", async ({ page }) => {
  await mockLoginFailure(page, "invalid_signature", 401);

  await page.goto("/login");

  const connectBtn = page.locator("#connect-wallet-btn");
  await connectBtn.click();

  const banner = page.locator("#login-error-banner");
  await expect(banner).toBeVisible({ timeout: 8_000 });

  await expect(connectBtn).toBeEnabled();
});

// ---------------------------------------------------------------------------
// UI: wallet-chip renders correctly (smoke)
// ---------------------------------------------------------------------------

test.skip("wallet-chip renders address with truncation after login", async ({ page }) => {
  // TODO Phase 3: once topbar uses WalletChip, check it renders in dashboard
});
