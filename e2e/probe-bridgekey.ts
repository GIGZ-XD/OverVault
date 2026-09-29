/**
 * BridgeKey API probe — run via Playwright test runner.
 *
 * Run from e2e/ with:
 *   npx playwright test probe-bridgekey.spec.ts --project=chromium --headed
 *
 * This test launches Chrome with the user's actual extension profile so
 * BridgeKey is active, then probes the window object to discover the API.
 *
 * IMPORTANT: Uses launchPersistentContext with the default Chrome user-data-dir
 * so installed extensions (including BridgeKey) are available.
 */
import { chromium } from "@playwright/test";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// Windows default Chrome user data directory
const USER_DATA_DIR = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Google",
  "Chrome",
  "User Data"
);

// Run as a standalone async function (not a Playwright test) so we can
// use launchPersistentContext directly.
async function probe() {
  console.log("=== BridgeKey API Probe ===");
  console.log("Chrome profile dir:", USER_DATA_DIR);
  console.log("Exists:", fs.existsSync(USER_DATA_DIR));
  console.log("Opening probe page...\n");

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: "chrome",
    headless: false,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-web-security"],
    timeout: 30000,
  });

  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:3000/bk-probe.html", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for 3-second event listener + rendering
    await page.waitForTimeout(7500);

    // Read the raw results object
    const results = await page.evaluate(() => {
      return {
        has_ethereum:  typeof window.ethereum !== "undefined",
        has_bridgekey: typeof window.bridgekey !== "undefined",
        has_mst:       typeof (window as any).mst !== "undefined",
        ethereum_type: typeof window.ethereum,
        isBridgeKey:   (window.ethereum as any)?.isBridgeKey,
        isMetaMask:    (window.ethereum as any)?.isMetaMask,
        chainId:       (window.ethereum as any)?.chainId,
        networkVersion:(window.ethereum as any)?.networkVersion,
        selectedAddr:  (window.ethereum as any)?.selectedAddress,
        hasRequest:    typeof (window.ethereum as any)?.request === "function",
        hasSend:       typeof (window.ethereum as any)?.send === "function",
        hasSendAsync:  typeof (window.ethereum as any)?.sendAsync === "function",
        hasOn:         typeof (window.ethereum as any)?.on === "function",
        hasRemoveListener: typeof (window.ethereum as any)?.removeListener === "function",
        hasEnable:     typeof (window.ethereum as any)?.enable === "function",
        constructorName: (window.ethereum as any)?.constructor?.name,
        ownKeys:       window.ethereum ? Object.keys(window.ethereum as object).slice(0, 60) : [],
        walletWindowKeys: Object.keys(window).filter(k =>
          /bridge|wallet|mst|ether|web3|chain|provider/i.test(k)
        ),
        providers: Array.isArray((window.ethereum as any)?.providers)
          ? (window.ethereum as any).providers.map((p: any) => ({
              isBridgeKey: p.isBridgeKey,
              isMetaMask: p.isMetaMask,
              chainId: p.chainId,
            }))
          : null,
      };
    });

    console.log("=== DIRECT RESULTS ===");
    console.log(JSON.stringify(results, null, 2));

    // Try eth_chainId
    if (results.hasRequest) {
      try {
        const chainId = await page.evaluate(async () => {
          return await (window.ethereum as any).request({ method: "eth_chainId" });
        });
        console.log("\neth_chainId:", chainId, "→ decimal:", parseInt(chainId as string, 16));
      } catch (e: any) {
        console.log("\neth_chainId error:", e.message);
      }

      // Try eth_accounts (no prompt)
      try {
        const accounts = await page.evaluate(async () => {
          return await (window.ethereum as any).request({ method: "eth_accounts" });
        });
        console.log("eth_accounts:", JSON.stringify(accounts));
      } catch (e: any) {
        console.log("eth_accounts error:", e.message);
      }

      // Try bad method to see error shape
      try {
        await page.evaluate(async () => {
          return await (window.ethereum as any).request({ method: "eth_invalidProbeMethod_99999" });
        });
      } catch (e: any) {
        console.log("error shape from bad method:", e.message);
      }
    }

    // Read rendered page text
    const pageText = await page.locator("#output").innerText();
    console.log("\n=== PROBE PAGE RENDERED OUTPUT ===");
    console.log(pageText.slice(0, 5000));

  } finally {
    await browser.close();
  }
}

probe().catch(console.error);
