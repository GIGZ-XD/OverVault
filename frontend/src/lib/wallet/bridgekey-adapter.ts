/**
 * BridgeKey Wallet adapter (owner: Pannaga) — Phase 2 implementation scaffold.
 *
 * STATUS: BLOCKED — BridgeKey browser extension API not yet documented in this
 * repository. The implementation skeleton below marks every unknown with a
 * BRIDGEKEY_API_REQUIRED comment. Once the BridgeKey API is confirmed, replace
 * each TODO block with the real call.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INFORMATION REQUIRED FROM BRIDGEKEY TEAM / DOCS:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [BK-1] Window injection key
 *        What property does BridgeKey inject on window?
 *        e.g. window.bridgekey, window.mst, window.ethereum (EIP-1193 provider)
 *
 * [BK-2] Installation detection
 *        How to detect if the extension is installed?
 *        e.g. typeof window.bridgekey !== "undefined"
 *            or window.ethereum?.isBridgeKey === true
 *
 * [BK-3] Connect / account request method
 *        How to request wallet connection and get the active address?
 *        EIP-1193: await window.ethereum.request({ method: "eth_requestAccounts" })
 *        Custom:   await window.bridgekey.connect()
 *
 * [BK-4] Network / chain ID
 *        What is the MST Testnet chain ID (as hex or decimal)?
 *        e.g. EIP-1193: "0x1" for mainnet; MST Testnet might be e.g. "0x4D2"
 *        Custom: window.bridgekey.getNetwork() → "MST Testnet"
 *
 * [BK-5] Personal sign (EIP-191)
 *        How to request a personal_sign (human-readable message)?
 *        EIP-1193: window.ethereum.request({ method: "personal_sign", params: [msg, address] })
 *        Custom:   window.bridgekey.signMessage(message)
 *
 * [BK-6] Send transaction
 *        How to send a pre-built transaction?
 *        EIP-1193: window.ethereum.request({ method: "eth_sendTransaction", params: [tx] })
 *        Custom:   window.bridgekey.sendTransaction(payload)
 *
 * [BK-7] User rejection error code
 *        What error code is thrown when the user rejects?
 *        EIP-1193: error.code === 4001
 *        Custom:   unknown
 *
 * [BK-8] Disconnect event
 *        How does the extension signal wallet disconnect?
 *        EIP-1193: window.ethereum.on("disconnect", handler)
 *        Custom:   unknown
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Until BridgeKey API is confirmed, NEXT_PUBLIC_WALLET_MODE must remain "mock".
 * The adapter throws WalletNotInstalledError for all real calls so the application
 * fails fast rather than silently misbehaving.
 */

import type { WalletAdapter } from "./adapter";
import {
  WalletNotInstalledError,
  WalletUserRejectedError,
  WalletNetworkError,
  WalletConnectionError,
} from "./adapter";

// ─── BridgeKey network constants ────────────────────────────────────────────
// BRIDGEKEY_API_REQUIRED [BK-4]: Replace with confirmed MST Testnet identifier.
const EXPECTED_NETWORK_NAME = "MST Testnet";
// const EXPECTED_CHAIN_ID = "0x???"; // [BK-4] replace with real MST Testnet chain ID

// ─── BridgeKey window type (to be confirmed) ────────────────────────────────
// BRIDGEKEY_API_REQUIRED [BK-1], [BK-3], [BK-5], [BK-6], [BK-7], [BK-8]:
// Once confirmed, extend this interface with the real BridgeKey API shape.
interface BridgeKeyProvider {
  // [BK-1] Placeholder — actual shape unknown
  readonly isBridgeKey?: boolean;
  // [BK-3]
  request?(args: { method: string; params?: unknown[] }): Promise<unknown>;
  // [BK-4]
  networkVersion?: string;
  chainId?: string;
  // [BK-8]
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    // [BK-1] — actual key name unknown; placeholder uses "bridgekey"
    bridgekey?: BridgeKeyProvider;
    // Also try window.ethereum in case BridgeKey is an EIP-1193 provider
    ethereum?: BridgeKeyProvider;
  }
}

// ─── Helper: get the provider if available ───────────────────────────────────
// BRIDGEKEY_API_REQUIRED [BK-1], [BK-2]: replace with confirmed detection logic.
function getProvider(): BridgeKeyProvider | null {
  if (typeof window === "undefined") return null;

  // Option A — BridgeKey injects a custom object
  if (window.bridgekey != null) return window.bridgekey;

  // Option B — BridgeKey is an EIP-1193 provider on window.ethereum
  // if (window.ethereum?.isBridgeKey) return window.ethereum;

  // Option C — BridgeKey replaces window.ethereum entirely
  // if (window.ethereum != null) return window.ethereum;

  return null;
}

// ─── Helper: read the active network name ────────────────────────────────────
// BRIDGEKEY_API_REQUIRED [BK-4]: replace with confirmed network detection.
async function getNetworkName(_provider: BridgeKeyProvider): Promise<string> {
  // EIP-1193 example:
  // const chainId = await provider.request?.({ method: "eth_chainId" });
  // return chainId === EXPECTED_CHAIN_ID ? EXPECTED_NETWORK_NAME : `Unknown (${chainId})`;

  // Custom example:
  // return (await provider.request?.({ method: "bk_getNetwork" })) as string;

  // STUB: unknown
  throw new WalletNotInstalledError();
}

// ─────────────────────────────────────────────────────────────────────────────
// BridgeKey Adapter implementation
// ─────────────────────────────────────────────────────────────────────────────

export const bridgekeyAdapter: WalletAdapter = {
  // ── isInstalled ────────────────────────────────────────────────────────────
  isInstalled(): boolean {
    // BRIDGEKEY_API_REQUIRED [BK-1], [BK-2]
    // Replace with: return getProvider() !== null;
    return getProvider() !== null;
  },

  // ── connect ────────────────────────────────────────────────────────────────
  async connect(): Promise<{ address: string; network: string }> {
    const provider = getProvider();
    if (!provider) {
      throw new WalletNotInstalledError();
    }

    let address: string;
    let network: string;

    try {
      // BRIDGEKEY_API_REQUIRED [BK-3]
      // EIP-1193 example:
      //   const accounts = await provider.request?.({ method: "eth_requestAccounts" }) as string[];
      //   address = accounts[0];
      //
      // Custom example:
      //   const result = await provider.request?.({ method: "bk_connect" }) as { address: string };
      //   address = result.address;
      //
      // STUB — throw until API is confirmed:
      throw new Error("BRIDGEKEY_API_REQUIRED: connect method not confirmed. See [BK-3].");
    } catch (err) {
      // BRIDGEKEY_API_REQUIRED [BK-7]
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: number }).code;
        // EIP-1193 user rejection: code 4001
        if (code === 4001) throw new WalletUserRejectedError();
      }
      if (err instanceof WalletNotInstalledError) throw err;
      throw new WalletConnectionError(
        err instanceof Error ? err.message : "Failed to connect BridgeKey wallet."
      );
    }

    // BRIDGEKEY_API_REQUIRED [BK-4]
    // provider is guaranteed non-null here (checked at top of connect())
    const confirmedProvider = provider as BridgeKeyProvider;
    try {
      network = await getNetworkName(confirmedProvider);
    } catch {
      network = "Unknown";
    }

    if (network !== EXPECTED_NETWORK_NAME) {
      throw new WalletNetworkError(EXPECTED_NETWORK_NAME, network);
    }

    return { address: address!.toLowerCase(), network };
  },

  // ── disconnect ─────────────────────────────────────────────────────────────
  async disconnect(): Promise<void> {
    // BRIDGEKEY_API_REQUIRED [BK-8]
    // BridgeKey may not have an explicit disconnect method.
    // EIP-1193 has no standard disconnect — rely on disconnect event instead.
    //
    // Example (if supported):
    // await getProvider()?.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  },

  // ── signMessage ────────────────────────────────────────────────────────────
  async signMessage(message: string): Promise<string> {
    const provider = getProvider();
    if (!provider) throw new WalletNotInstalledError();

    try {
      // BRIDGEKEY_API_REQUIRED [BK-5]
      // EIP-191 personal_sign example:
      //   const accounts = await provider.request?.({ method: "eth_accounts" }) as string[];
      //   const address = accounts[0];
      //   const signature = await provider.request?.({
      //     method: "personal_sign",
      //     params: [message, address],
      //   }) as string;
      //   return signature;
      //
      // Custom example:
      //   return await provider.request?.({ method: "bk_signMessage", params: [message] }) as string;
      //
      // STUB:
      throw new Error("BRIDGEKEY_API_REQUIRED: signMessage method not confirmed. See [BK-5].");
    } catch (err) {
      // BRIDGEKEY_API_REQUIRED [BK-7]
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: number }).code;
        if (code === 4001) throw new WalletUserRejectedError();
      }
      if (err instanceof WalletNotInstalledError || err instanceof WalletUserRejectedError) throw err;
      throw new WalletConnectionError(
        err instanceof Error ? err.message : "Failed to sign message."
      );
    }
  },

  // ── sendTransaction ────────────────────────────────────────────────────────
  async sendTransaction(payload: unknown): Promise<{ txHash: string }> {
    const provider = getProvider();
    if (!provider) throw new WalletNotInstalledError();

    try {
      // BRIDGEKEY_API_REQUIRED [BK-6]
      // EIP-1193 example:
      //   const txHash = await provider.request?.({
      //     method: "eth_sendTransaction",
      //     params: [payload],
      //   }) as string;
      //   return { txHash };
      //
      // Custom example:
      //   const result = await provider.request?.({ method: "bk_sendTransaction", params: [payload] });
      //   return { txHash: (result as { hash: string }).hash };
      //
      // STUB:
      throw new Error("BRIDGEKEY_API_REQUIRED: sendTransaction method not confirmed. See [BK-6].");
    } catch (err) {
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: number }).code;
        if (code === 4001) throw new WalletUserRejectedError();
      }
      if (err instanceof WalletNotInstalledError || err instanceof WalletUserRejectedError) throw err;
      throw new WalletConnectionError(
        err instanceof Error ? err.message : "Failed to send transaction."
      );
    }
  },
};

// ─── Disconnect event listener helper ────────────────────────────────────────
// BRIDGEKEY_API_REQUIRED [BK-8]: replace with confirmed event name + handler pattern.
export function onWalletDisconnect(handler: () => void): () => void {
  const provider = getProvider();
  if (!provider?.on) return () => {};

  // EIP-1193 uses "disconnect" event; BridgeKey may differ.
  // provider.on("disconnect", handler);  // [BK-8]
  // provider.on("accountsChanged", (accounts) => { if (!accounts.length) handler(); }); // alternative

  return () => {
    // provider.removeListener?.("disconnect", handler);  // [BK-8]
  };
}
