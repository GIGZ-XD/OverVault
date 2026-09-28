/**
 * BridgeKey API probe — run with Node.js + Playwright directly.
 * Usage: node probe-bridgekey.mjs
 *
 * Opens http://localhost:3000/bk-probe.html in a real Chromium browser
 * (with extensions loaded), waits for the probe to complete, then
 * captures all the text output and prints it to stdout.
 *
 * NOTE: Playwright's standard chromium launch does NOT load extensions.
 * We must use launchPersistentContext with the extension path OR
 * read the probe results from the page DOM after navigating.
 *
 * Since the extension is installed in the user's default Chrome profile,
 * we use the default Chrome user data directory.
 */

import { chromium } from '@playwright/test';
import path from 'path';
import os from 'os';

// Windows Chrome user data directory
const userDataDir = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');

console.log('=== BridgeKey API Probe ===');
console.log('Chrome user data dir:', userDataDir);
console.log('Opening probe page...\n');

let browser;
try {
  // Launch with persistent context so Chrome extensions are loaded
  browser = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = await browser.newPage();

  // Navigate to the probe page
  await page.goto('http://localhost:3000/bk-probe.html', { waitUntil: 'networkidle' });

  // Wait for probe to complete (includes 3-second event listener wait + rendering)
  await page.waitForTimeout(7000);

  // Extract all text from the page
  const pageText = await page.evaluate(() => {
    return document.body.innerText;
  });

  console.log('=== PROBE PAGE OUTPUT ===');
  console.log(pageText);

  // Also extract the raw results object from window._bkResults
  const rawResults = await page.evaluate(() => {
    return JSON.stringify(window._bkResults || {}, null, 2);
  });

  console.log('\n=== RAW RESULTS OBJECT ===');
  console.log(rawResults);

  // Check specific values
  const details = await page.evaluate(() => {
    return {
      has_ethereum:  typeof window.ethereum !== 'undefined',
      has_bridgekey: typeof window.bridgekey !== 'undefined',
      isBridgeKey:   window.ethereum?.isBridgeKey,
      isMetaMask:    window.ethereum?.isMetaMask,
      chainId:       window.ethereum?.chainId,
      selectedAddr:  window.ethereum?.selectedAddress,
      hasRequest:    typeof window.ethereum?.request === 'function',
      hasOn:         typeof window.ethereum?.on === 'function',
      walletKeys:    Object.keys(window).filter(k => /bridge|wallet|mst|ether|web3|chain/i.test(k)),
    };
  });

  console.log('\n=== DIRECT EVALUATION ===');
  console.log(JSON.stringify(details, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  if (browser) await browser.close();
  process.exit(0);
}
