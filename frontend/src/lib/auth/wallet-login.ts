/**
 * Wallet authentication service (Pannaga).
 *
 * This module owns the complete wallet-login flow:
 *   wallet.connect()
 *     → POST /auth/nonce
 *     → wallet.signMessage()
 *     → POST /auth/wallet-login
 *     → WalletLoginResult
 *
 * ─────────────────────────────────────────────
 * VINEETH HANDOFF BOUNDARY
 * ─────────────────────────────────────────────
 * This service returns WalletLoginResult which contains access_token.
 * Vineeth's JWT layer issues the token; this service just stores/uses it.
 * Session persistence (cookies, localStorage, refresh tokens) is Vineeth's concern.
 * This file must NOT implement JWT parsing or session management.
 * ─────────────────────────────────────────────
 */

import { wallet } from "@/lib/wallet";
import { api } from "@/lib/api/client";
import { setToken, getToken, clearToken } from "@/lib/api/token";
import {
  WalletUserRejectedError,
  WalletNetworkError,
  WalletNotInstalledError,
} from "@/lib/wallet/adapter";

// ---------------------------------------------------------------------------
// Types (matching backend schemas/auth.py)
// ---------------------------------------------------------------------------

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface WalletLoginResult {
  access_token: string;
  token_type: string;
}

// ---------------------------------------------------------------------------
// API calls — kept isolated so they can be mocked in tests
// ---------------------------------------------------------------------------

export async function requestNonce(address: string): Promise<NonceResponse> {
  return api<NonceResponse>("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function submitWalletLogin(
  address: string,
  signature: string
): Promise<WalletLoginResult> {
  return api<WalletLoginResult>("/auth/wallet-login", {
    method: "POST",
    body: JSON.stringify({ address, signature }),
  });
}

// ---------------------------------------------------------------------------
// Login flow errors
// ---------------------------------------------------------------------------

export type LoginErrorCode =
  | "wallet_not_installed"
  | "wallet_connection_failed"
  | "user_rejected"
  | "wrong_network"
  | "nonce_request_failed"
  | "invalid_signature"
  | "address_not_found"
  | "nonce_expired"
  | "unknown";

export class LoginError extends Error {
  readonly code: LoginErrorCode;
  constructor(code: LoginErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LoginError";
  }
}

// ---------------------------------------------------------------------------
// Main login flow
// ---------------------------------------------------------------------------

/**
 * Execute the complete wallet-login flow.
 *
 * Steps:
 * 1. Check wallet is installed.
 * 2. Connect wallet → get address + network.
 * 3. POST /auth/nonce → get signing message.
 * 4. wallet.signMessage(message) → signature.
 * 5. POST /auth/wallet-login → WalletLoginResult.
 *
 * Returns WalletLoginResult for the JWT handoff layer (Vineeth).
 * Throws LoginError for all handled failure cases.
 */
export async function walletLogin(): Promise<WalletLoginResult> {
  // Step 1 — check installation
  if (!wallet.isInstalled()) {
    throw new LoginError(
      "wallet_not_installed",
      "BridgeKey Wallet is not installed."
    );
  }

  // Step 2 — connect
  let address: string;
  try {
    const conn = await wallet.connect();
    address = conn.address.toLowerCase();
  } catch (err) {
    if (err instanceof WalletNotInstalledError)
      throw new LoginError("wallet_not_installed", err.message);
    if (err instanceof WalletNetworkError)
      throw new LoginError("wrong_network", err.message);
    throw new LoginError(
      "wallet_connection_failed",
      err instanceof Error ? err.message : "Failed to connect wallet."
    );
  }

  // Step 3 — request nonce
  let nonceResp: NonceResponse;
  try {
    nonceResp = await requestNonce(address);
  } catch {
    throw new LoginError(
      "nonce_request_failed",
      "Failed to get authentication nonce. Please try again."
    );
  }

  // Step 4 — sign
  let signature: string;
  try {
    signature = await wallet.signMessage(nonceResp.message);
  } catch (err) {
    if (err instanceof WalletUserRejectedError)
      throw new LoginError("user_rejected", "Signature declined.");
    throw new LoginError(
      "user_rejected",
      "Signature request was declined or timed out."
    );
  }

  // Step 5 — verify on backend
  try {
    return await submitWalletLogin(address, signature);
  } catch (err) {
    // Use ApiError's status and code fields for precise error mapping
    const status = (err as { status?: number }).status;
    const code = (err as { code?: string }).code;
    if (status === 401 || code === "nonce_expired" || code === "invalid_signature") {
      throw new LoginError(
        "invalid_signature",
        "Authentication failed. Please try again."
      );
    }
    if (status === 403 || code === "address_not_found") {
      throw new LoginError(
        "address_not_found",
        "Your wallet address is not registered. Contact your administrator."
      );
    }
    throw new LoginError("unknown", "Login failed. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// VINEETH HANDOFF — session management
// ---------------------------------------------------------------------------

/**
 * Store the token returned by walletLogin().
 *
 * Delegates to token.ts (localStorage["overvault.token"]) so the API
 * client's getToken() call in client.ts can read it on every request.
 *
 * NOTE (Vineeth): Replace with your session/cookie implementation by
 * swapping out token.ts's setToken() — all callers will follow automatically.
 */
export function storeSession(result: WalletLoginResult): void {
  setToken(result.access_token);
}

/**
 * Retrieve the current session token.
 *
 * NOTE (Vineeth): Replace token.ts.getToken() with your session retrieval mechanism.
 */
export function getSessionToken(): string | null {
  return getToken();
}

/**
 * Clear the current session.
 *
 * NOTE (Vineeth): Replace token.ts.clearToken() with your session cleanup mechanism.
 */
export function clearSession(): void {
  clearToken();
}

/** Returns true if a session token is present (does not validate it). */
export function hasSession(): boolean {
  return getToken() !== null;
}

