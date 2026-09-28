/**
 * BridgeKey Wallet adapter — Phase 2 real implementation (owner: Pannaga).
 *
 * Confirmed runtime environment (manually verified 2026-09-28):
 *   Provider   : window.ethereum
 *   Identity   : window.ethereum.isBridgeKey === true
 *   Standard   : EIP-1193 (provider.request())
 *   Chain      : MST Testnet — chainId 0x5752035 (decimal 91562037)
 *   Methods    : eth_requestAccounts, eth_chainId, eth_accounts,
 *                personal_sign, eth_sendTransaction
 *   Events     : accountsChanged, chainChanged, disconnect
 *
 * Architecture rule: nothing outside this file may access window.ethereum.
 * All other application code must go through WalletAdapter.
 */

import type { WalletAdapter } from "./adapter";
import {
  WalletNotInstalledError,
  WalletUserRejectedError,
  WalletNetworkError,
  WalletConnectionError,
} from "./adapter";

// ─── MST Testnet constants ────────────────────────────────────────────────────
const MST_CHAIN_ID_HEX = "0x5752035";       // confirmed: 91562037 decimal
const MST_NETWORK_NAME = "MST Testnet";

// ─── EIP-1193 error codes ─────────────────────────────────────────────────────
// 4001 = User Rejected Request (EIP-1193 standard)
// -32601 = Method Not Found (NOT user rejection — do not map to WalletUserRejectedError)
const EIP1193_USER_REJECTED = 4001;

// ─── EIP-1193 provider shape ──────────────────────────────────────────────────
interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  isBridgeKey?: boolean;
  isMetaMask?: boolean;
  chainId?: string;
  selectedAddress?: string | null;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

// ─── Provider accessor ───────────────────────────────────────────────────────
/**
 * Returns the BridgeKey EIP-1193 provider if installed, null otherwise.
 * Safe to call during SSR (returns null when window is undefined).
 */
function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const p = window.ethereum;
  // BridgeKey is identified by isBridgeKey=true on the injected provider.
  // If another wallet (MetaMask etc.) is also installed and takes window.ethereum,
  // the providers[] array (EIP-6963) may be needed — but confirmed probe showed
  // BridgeKey sets isBridgeKey=true on window.ethereum directly.
  if (p && p.isBridgeKey === true) return p;
  return null;
}

// ─── Error classifier ────────────────────────────────────────────────────────
/**
 * Maps a raw provider error to the WalletAdapter error hierarchy.
 * Uses EIP-1193 standard codes where confirmed; preserves unknown errors.
 */
function classifyProviderError(err: unknown): never {
  if (err instanceof WalletNotInstalledError ||
      err instanceof WalletUserRejectedError  ||
      err instanceof WalletNetworkError       ||
      err instanceof WalletConnectionError) {
    throw err; // already classified — re-throw as-is
  }

  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: number }).code;
    // EIP-1193: 4001 = user explicitly rejected the request
    if (code === EIP1193_USER_REJECTED) {
      throw new WalletUserRejectedError();
    }
    // -32002 = request already pending (another connect is in flight)
    if (code === -32002) {
      throw new WalletConnectionError(
        "A BridgeKey request is already pending. Open the extension to respond."
      );
    }
    // Preserve other provider errors with their original message
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown wallet error.";

  throw new WalletConnectionError(message);
}

// ─── Network helpers ─────────────────────────────────────────────────────────
async function getChainId(provider: EIP1193Provider): Promise<string> {
  return (await provider.request({ method: "eth_chainId" })) as string;
}

async function getNetworkName(provider: EIP1193Provider): Promise<string> {
  const chainId = await getChainId(provider);
  if (chainId.toLowerCase() === MST_CHAIN_ID_HEX.toLowerCase()) {
    return MST_NETWORK_NAME;
  }
  return `Unknown network (chainId ${chainId})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BridgeKey WalletAdapter implementation
// ─────────────────────────────────────────────────────────────────────────────

export const bridgekeyAdapter: WalletAdapter = {
  // ── isInstalled ────────────────────────────────────────────────────────────
  // BK-2: Detect installation via window.ethereum.isBridgeKey === true
  isInstalled(): boolean {
    return getProvider() !== null;
  },

  // ── connect ────────────────────────────────────────────────────────────────
  // BK-3: eth_requestAccounts → address
  // BK-4: eth_chainId → validate MST Testnet
  async connect(): Promise<{ address: string; network: string }> {
    const provider = getProvider();
    if (!provider) throw new WalletNotInstalledError();

    let accounts: string[];

    try {
      // Prompts the BridgeKey popup — user approves or rejects
      accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
    } catch (err) {
      classifyProviderError(err);
    }

    if (!accounts!.length) {
      throw new WalletConnectionError(
        "No accounts returned from BridgeKey. Did you connect an account?"
      );
    }

    // Validate network
    let chainId: string;
    try {
      chainId = await getChainId(provider);
    } catch (err) {
      classifyProviderError(err);
    }

    if (chainId!.toLowerCase() !== MST_CHAIN_ID_HEX.toLowerCase()) {
      const networkName = await getNetworkName(provider).catch(() => `chainId ${chainId}`);
      throw new WalletNetworkError(MST_NETWORK_NAME, networkName);
    }

    const address = accounts![0].toLowerCase();
    return { address, network: MST_NETWORK_NAME };
  },

  // ── disconnect ─────────────────────────────────────────────────────────────
  // EIP-1193 has no standard disconnect RPC — we simply clean up locally.
  // Actual account unlinking is driven by accountsChanged events (see onWalletDisconnect).
  async disconnect(): Promise<void> {
    // No provider call required; the extension manages its own session.
    // Application state cleanup is handled by the component/context layer.
  },

  // ── signMessage ────────────────────────────────────────────────────────────
  // BK-5: personal_sign (EIP-191)
  // Param order confirmed: [message, address]
  async signMessage(message: string): Promise<string> {
    const provider = getProvider();
    if (!provider) throw new WalletNotInstalledError();

    // Get the current connected address
    let accounts: string[];
    try {
      accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
    } catch (err) {
      classifyProviderError(err);
    }

    if (!accounts!.length) {
      throw new WalletConnectionError(
        "Wallet is not connected. Please connect BridgeKey before signing."
      );
    }

    // Validate network before signing (network may have changed since connect)
    let chainId: string;
    try {
      chainId = await getChainId(provider);
    } catch (err) {
      classifyProviderError(err);
    }

    if (chainId!.toLowerCase() !== MST_CHAIN_ID_HEX.toLowerCase()) {
      const networkName = await getNetworkName(provider).catch(() => `chainId ${chainId}`);
      throw new WalletNetworkError(MST_NETWORK_NAME, networkName);
    }

    // personal_sign: params = [message, address]
    // EIP-191: signs "\x19Ethereum Signed Message:\n" + message.length + message
    let signature: string;
    try {
      signature = (await provider.request({
        method: "personal_sign",
        params: [message, accounts![0]],
      })) as string;
    } catch (err) {
      classifyProviderError(err);
    }

    return signature!;
  },

  // ── sendTransaction ────────────────────────────────────────────────────────
  // BK-6: eth_sendTransaction
  // Only called from the signing workflow — payload must come from the app,
  // not invented here. Returns the provider tx hash.
  async sendTransaction(payload: unknown): Promise<{ txHash: string }> {
    const provider = getProvider();
    if (!provider) throw new WalletNotInstalledError();

    let txHash: string;
    try {
      txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [payload],
      })) as string;
    } catch (err) {
      classifyProviderError(err);
    }

    return { txHash: txHash! };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BK-8: Disconnect and event helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers a handler that fires when the wallet disconnects or the active
 * account changes to an empty list.
 *
 * Returns a cleanup function — call it in useEffect cleanup or component unmount.
 *
 * Usage:
 *   const cleanup = onWalletDisconnect(() => router.replace("/login"));
 *   return cleanup; // in useEffect return
 */
export function onWalletDisconnect(handler: () => void): () => void {
  const provider = getProvider();
  if (!provider) return () => {};

  // accountsChanged([]) fires when the user disconnects or locks the wallet
  const onAccountsChanged = (accounts: unknown) => {
    if (Array.isArray(accounts) && accounts.length === 0) {
      handler();
    }
  };

  // EIP-1193 disconnect event (also fires on network errors)
  const onDisconnect = () => {
    handler();
  };

  provider.on("accountsChanged", onAccountsChanged as () => void);
  provider.on("disconnect", onDisconnect);

  return () => {
    provider.removeListener("accountsChanged", onAccountsChanged as () => void);
    provider.removeListener("disconnect", onDisconnect);
  };
}

/**
 * Registers a handler that fires when the active chain changes.
 * Validates the new chain against MST Testnet and calls onWrongNetwork
 * if the user switches away.
 *
 * Returns a cleanup function.
 */
export function onChainChanged(
  onCorrectNetwork: () => void,
  onWrongNetwork: (chainId: string) => void
): () => void {
  const provider = getProvider();
  if (!provider) return () => {};

  const handleChainChanged = (chainId: unknown) => {
    const id = (chainId as string).toLowerCase();
    if (id === MST_CHAIN_ID_HEX.toLowerCase()) {
      onCorrectNetwork();
    } else {
      onWrongNetwork(chainId as string);
    }
  };

  provider.on("chainChanged", handleChainChanged as () => void);

  return () => {
    provider.removeListener("chainChanged", handleChainChanged as () => void);
  };
}

// Export constants for use in tests or UI
export { MST_CHAIN_ID_HEX, MST_NETWORK_NAME };
