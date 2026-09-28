import { test, expect } from "@playwright/test";

const fixtureEvent = {
  id: "e1",
  event_type: "ownership_register",
  file_id: "f1",
  actor: "0xaaa1",
  tx_hash: "0xtx1",
  verification: "verified",
  timestamp: 1788000000,
};

test("audit page renders event proof and dashboard integrity", async ({ page }) => {
  await page.route("http://localhost:8000/api/audit", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([fixtureEvent]),
    })
  );
  await page.route("http://localhost:8000/api/files", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "f1",
          name: "Q3-contract.pdf",
          owner: "u1",
          size: 482113,
          protection: "read-only",
          verification: "verified",
          hash: "0x9f3a11c21e",
          ownership_tx: "0xtx1",
        },
      ]),
    })
  );

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible();
  const auditTable = page.getByRole("table");
  await expect(auditTable.getByRole("cell", { name: "Ownership Register", exact: true })).toBeVisible();
  await expect(auditTable.getByRole("cell", { name: "f1", exact: true })).toBeVisible();
  await expect(auditTable.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Wallet: 0xaaa1")).toBeVisible();
  await expect(page.getByLabel(/Transaction: 0xtx1/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Integrity health")).toBeVisible();
  await expect(page.getByLabel("Hash: 0x9f3a11c21e")).toBeVisible();
  await expect(page.getByLabel(/Transaction: 0xtx1/)).toBeVisible();
});

test("audit page supports empty filtered results", async ({ page }) => {
  await page.route("http://localhost:8000/api/audit", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([fixtureEvent]),
    })
  );

  await page.goto("/audit");
  await page.getByPlaceholder("Search actor or file").fill("does-not-exist");
  await expect(page.getByText("No audit events found")).toBeVisible();
});

test("audit page renders pending, failed, missing tx, and long values", async ({ page }) => {
  const longActor = "0x1234567890abcdef1234567890abcdef12345678";
  const longTx = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  await page.route("http://localhost:8000/api/audit", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { ...fixtureEvent, id: "pending", verification: "pending", tx_hash: null },
        { ...fixtureEvent, id: "failed", verification: "tampered", tx_hash: longTx, actor: longActor },
      ]),
    })
  );

  await page.goto("/audit");
  const auditTable = page.getByRole("table");
  await expect(auditTable.getByText("Pending", { exact: true })).toBeVisible();
  await expect(auditTable.getByText("Failed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Transaction pending")).toBeVisible();
  await expect(page.getByLabel(new RegExp(`Wallet: ${longActor}`))).toBeVisible();
  await expect(page.getByLabel(new RegExp(`Transaction: ${longTx}`))).toBeVisible();
});