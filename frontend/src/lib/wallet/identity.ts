/**
 * Identity & Device Wallet Management for OverVault
 * Ensures each browser/device has a unique cryptographic wallet address
 * and prevents guest/friend users from overwriting or colliding with Pavan (u1 / 0xaaa1).
 */

export function getOrCreateDeviceWallet(): string {
  if (typeof window === "undefined") {
    return "0x1000000000000000000000000000000000000000";
  }

  const stored = localStorage.getItem("overvault_device_wallet");
  if (stored && stored.toLowerCase() !== "0xaaa1" && stored.startsWith("0x") && stored.length >= 10) {
    return stored;
  }

  // Generate a distinct 20-byte (40 hex chars) Ethereum-style address
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const newWallet = "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  localStorage.setItem("overvault_device_wallet", newWallet);
  return newWallet;
}

export function resolveWalletForUser(name?: string, web3Address?: string | null): string {
  const cleanName = (name || "").trim().toLowerCase();

  // If the user explicitly identifies as Pavan
  if (cleanName === "pavan" || cleanName.startsWith("pavan ")) {
    return "0xaaa1";
  }

  // If a real web3 extension (MetaMask, BridgeKey) provided an account
  if (web3Address && web3Address.toLowerCase() !== "0xaaa1") {
    return web3Address.toLowerCase();
  }

  // Otherwise, use/generate this device's unique persistent address
  return getOrCreateDeviceWallet();
}
