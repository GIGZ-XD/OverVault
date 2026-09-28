/**
 * E2E: Signing modal (Pannaga)
 *
 * Uses mock wallet adapter (no BridgeKey required).
 * Tests the three-step UI: confirm → signing → result.
 * All four payload types are covered.
 *
 * The signing modal is rendered via a test harness page (not the full app)
 * because it is a standalone component.  In Phase 3 it will be triggered
 * from real feature flows (file upload, permission grant, approval).
 */
import { test, expect } from "@playwright/test";

// The signing modal is not yet wired into a routable page, so we
// skip these tests until Phase 3 integration is complete.
// They are kept here as a specification of expected behavior.

test.skip("signing modal — ownership_register happy path", async ({ page }) => {
  // TODO Phase 3: navigate to a page that renders SigningModal with
  // walletOverride=mockAdapter and payload={action:"ownership_register",...}
  // Expect:
  //   1. Modal appears with "Register ownership" title
  //   2. "Sign with BridgeKey" button is visible
  //   3. Click sign → brief "Check your BridgeKey wallet…" state
  //   4. Mock adapter returns MOCK_SIGNATURE immediately
  //   5. Success state appears with truncated signature
  //   6. Done button dismisses
  await page.goto("/");
});

test.skip("signing modal — permission_grant happy path", async ({ page }) => {
  await page.goto("/");
});

test.skip("signing modal — approval_decision (Approve) happy path", async ({ page }) => {
  await page.goto("/");
});

test.skip("signing modal — user rejection shows retry option", async ({ page }) => {
  // TODO: configure walletOverride to throw WalletUserRejectedError
  // Expect:
  //   - "Signature declined. You can try again." error banner
  //   - "Try again" button resets to confirm state
  //   - nonce remains valid (not re-requested)
  await page.goto("/");
});

test.skip("signing modal — wrong network shows error, no retry", async ({ page }) => {
  // TODO: configure walletOverride to throw WalletNetworkError
  // Expect: error mentions "MST Testnet", no retry (user must switch network)
  await page.goto("/");
});

test.skip("signing modal — cancel before signing", async ({ page }) => {
  // Expect: onCancel callback fires, modal closes, no signature attempt
  await page.goto("/");
});
