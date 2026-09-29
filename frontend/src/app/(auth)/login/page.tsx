"use client";

/**
 * Login / Connect Wallet page (Pannaga).
 *
 * States: idle → connecting → awaiting-signature → success → (redirect)
 * Error states: not-installed | connection-failed | user-rejected |
 *               wrong-network | address-not-found | nonce-expired | unknown
 *
 * Uses wallet adapter (mock or BridgeKey) — never touches wallet internals directly.
 * Session handoff: calls storeSession() which is the Vineeth boundary.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  walletLogin,
  storeSession,
  hasSession,
  type LoginErrorCode,
  LoginError,
} from "@/lib/auth/wallet-login";
import { config } from "@/lib/config";
import { wallet } from "@/lib/wallet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoginState =
  | "idle"
  | "connecting"
  | "awaiting-signature"
  | "verifying"
  | "success";

interface ErrorState {
  code: LoginErrorCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Sub-components (inline for Phase 1 — move to features/auth/ if Pavan needs them)
// ---------------------------------------------------------------------------

function ShieldIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 12h.01" />
      <path d="M2 10h20" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function errorLabel(code: LoginErrorCode): string {
  switch (code) {
    case "wallet_not_installed":
      return "BridgeKey Wallet is not installed";
    case "user_rejected":
      return "Signature declined";
    case "wrong_network":
      return "Wrong network";
    case "address_not_found":
      return "Address not registered";
    case "nonce_expired":
      return "Session expired";
    case "wallet_connection_failed":
    case "nonce_request_failed":
    case "invalid_signature":
    case "unknown":
      return "Login failed";
  }
}

function errorAction(code: LoginErrorCode): string {
  switch (code) {
    case "wallet_not_installed":
      return "Install BridgeKey Wallet extension and reload the page.";
    case "user_rejected":
      return "Signature declined. Click Connect again to retry.";
    case "wrong_network":
      return "Switch your wallet to MST Testnet and try again.";
    case "address_not_found":
      return "Your wallet address is not registered. Contact your administrator.";
    case "nonce_expired":
      return "The session timed out. Click Connect again.";
    case "wallet_connection_failed":
      return "Could not connect to wallet. Ensure it is unlocked and try again.";
    case "nonce_request_failed":
      return "Could not reach the server. Check your connection and try again.";
    case "invalid_signature":
      return "Signature verification failed. Please try again.";
    case "unknown":
      return "An unexpected error occurred. Please try again.";
  }
}

function stateLabel(state: LoginState): string {
  switch (state) {
    case "idle":
      return "Connect BridgeKey Wallet";
    case "connecting":
      return "Connecting…";
    case "awaiting-signature":
      return "Check your BridgeKey wallet…";
    case "verifying":
      return "Verifying…";
    case "success":
      return "Authenticated";
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const refreshWalletState = () => {
      const installed = wallet.isInstalled();
      setIsInstalled(installed);
      if (installed) {
        setError((currentError) =>
          currentError?.code === "wallet_not_installed" ? null : currentError
        );
      }
    };

    refreshWalletState();
    window.addEventListener("load", refreshWalletState);
    window.addEventListener("focus", refreshWalletState);
    window.addEventListener("pageshow", refreshWalletState);
    window.addEventListener("ethereum#initialized", refreshWalletState);
    document.addEventListener("visibilitychange", refreshWalletState);

    if (hasSession()) {
      router.replace("/dashboard");
    }

    return () => {
      window.removeEventListener("load", refreshWalletState);
      window.removeEventListener("focus", refreshWalletState);
      window.removeEventListener("pageshow", refreshWalletState);
      window.removeEventListener("ethereum#initialized", refreshWalletState);
      document.removeEventListener("visibilitychange", refreshWalletState);
    };
  }, [router]);

  const handleConnect = async () => {
    setError(null);

    // Manually step through states so the UI reflects each phase
    setLoginState("connecting");

    try {
      // walletLogin() drives: connect → nonce → sign → verify
      // We can't hook into the middle of it cleanly without splitting it.
      // For the UI, we advance state optimistically — connecting shows first,
      // then awaiting-signature after a tick (sign happens inside walletLogin).
      // Phase 2 will refactor to use individual step hooks if needed.
      const result = await walletLogin();
      setLoginState("success");
      storeSession(result); // VINEETH HANDOFF — stores access_token
      // Small delay so "Authenticated" state is visible, then redirect
      setTimeout(() => router.replace("/dashboard"), 600);
    } catch (err) {
      setLoginState("idle");
      if (err instanceof LoginError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({ code: "unknown", message: "An unexpected error occurred." });
      }
    }
  };

  const busy = loginState !== "idle" && loginState !== "success";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-lg border p-8 shadow-sm"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Logo / brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <ShieldIcon
            className="w-12 h-12"
            style={{ color: "var(--accent)" }}
          />
          <div className="text-center">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              OverVault
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Blockchain-audited document management
            </p>
          </div>
        </div>

        {/* Wallet detection status */}
        {isInstalled === null && (
          <div
            className="rounded-md px-4 py-3 mb-5 text-sm"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
            role="status"
            aria-live="polite"
          >
            Checking BridgeKey Wallet availability…
          </div>
        )}

        {isInstalled === false && (
          <div
            className="rounded-md px-4 py-3 mb-5 text-sm"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
            role="alert"
          >
            <strong>BridgeKey Wallet not detected.</strong>{" "}
            Install the extension to sign in, or use{" "}
            <code className="text-xs font-mono">NEXT_PUBLIC_WALLET_MODE=mock</code>{" "}
            for development.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            id="login-error-banner"
            className="rounded-md px-4 py-3 mb-5 text-sm"
            style={{
              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
              borderColor: "var(--danger)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
            }}
            role="alert"
            aria-live="assertive"
          >
            <strong>{errorLabel(error.code)}.</strong>{" "}
            {errorAction(error.code)}
          </div>
        )}

        {/* Signing-state notice */}
        {loginState === "awaiting-signature" && (
          <div
            className="rounded-md px-4 py-3 mb-5 text-sm flex items-center gap-2"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
            role="status"
            aria-live="polite"
          >
            <Spinner className="w-4 h-4 flex-shrink-0" />
            <span>Check your BridgeKey wallet to sign the message.</span>
          </div>
        )}

        {/* Connect button */}
        <button
          id="connect-wallet-btn"
          type="button"
          onClick={handleConnect}
          disabled={busy || loginState === "success"}
          aria-busy={busy}
          aria-label={stateLabel(loginState)}
          className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background:
              loginState === "success"
                ? "var(--success)"
                : "var(--accent)",
            color: "#fff",
          }}
        >
          {busy ? (
            <Spinner className="w-4 h-4" />
          ) : loginState === "success" ? (
            /* checkmark */
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <WalletIcon className="w-4 h-4" />
          )}
          <span>{stateLabel(loginState)}</span>
        </button>

        {/* State hint below button */}
        <p
          className="text-xs text-center mt-3"
          style={{ color: "var(--text-muted)" }}
        >
          {loginState === "idle" &&
            "You will be asked to sign a message — no gas required."}
          {loginState === "connecting" && "Opening wallet…"}
          {loginState === "awaiting-signature" &&
            "Sign the message in your wallet to prove ownership."}
          {loginState === "verifying" && "Verifying signature on server…"}
          {loginState === "success" && "Redirecting to dashboard…"}
        </p>

        {/* Dev mode indicator */}
        {process.env.NODE_ENV === "development" && (
          <p
            className="text-xs text-center mt-6 font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            wallet:{" "}
            {config.walletMode} · api:{" "}
            {process.env.NEXT_PUBLIC_API_MODE ?? "mock"}
          </p>
        )}
      </div>
    </div>
  );
}
