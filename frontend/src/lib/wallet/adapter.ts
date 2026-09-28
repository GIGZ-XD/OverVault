/**
 * WalletAdapter interface (owner: Pannaga).
 *
 * All wallet implementations (mock, BridgeKey) must satisfy this contract.
 * Pavan builds UI against this via MockWalletAdapter.
 * Never import BridgeKey-specific APIs outside of bridgekey-adapter.ts.
 */
export interface WalletAdapter {
  /** Returns true if the wallet extension is installed in the browser. */
  isInstalled(): boolean;

  /**
   * Request wallet connection and return the active address and network name.
   * Throws WalletConnectionError if the user rejects or wallet is unavailable.
   */
  connect(): Promise<{ address: string; network: string }>;

  /** Disconnect the wallet session. */
  disconnect(): Promise<void>;

  /**
   * Request the wallet to sign a plaintext message (EIP-191 personal_sign).
   * Throws WalletUserRejectedError if the user declines.
   * Throws WalletNetworkError if the wallet is on the wrong network.
   */
  signMessage(message: string): Promise<string>;

  /**
   * Send a pre-built transaction payload.
   * Returns the transaction hash.
   * Throws WalletUserRejectedError if the user declines.
   */
  sendTransaction(payload: unknown): Promise<{ txHash: string }>;
}

// ---------------------------------------------------------------------------
// Wallet error types — thrown by adapters, caught by UI components
// ---------------------------------------------------------------------------

export class WalletError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "WalletError";
  }
}

export class WalletNotInstalledError extends WalletError {
  constructor() {
    super("wallet_not_installed", "BridgeKey Wallet is not installed.");
  }
}

export class WalletConnectionError extends WalletError {
  constructor(detail?: string) {
    super("wallet_connection_failed", detail ?? "Failed to connect wallet.");
  }
}

export class WalletUserRejectedError extends WalletError {
  constructor() {
    super("user_rejected", "Signature declined.");
  }
}

export class WalletNetworkError extends WalletError {
  constructor(expected: string, actual: string) {
    super(
      "wrong_network",
      `Please switch your wallet to ${expected}. (Current: ${actual})`
    );
  }
}
