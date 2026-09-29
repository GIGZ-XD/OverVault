"use client";

/**
 * SigningModal — wallet signing confirmation flow (Pannaga).
 *
 * Driven by specs/signing_payloads.json. Works with any WalletAdapter
 * (mock OR BridgeKey). Never calls BridgeKey directly.
 *
 * Supported actions: ownership_register | permission_grant | permission_revoke | approval_decision
 *
 * Three-step UI (per DESIGN.md §8):
 *   1. Confirm — plain-language summary of the action.
 *   2. Signing — "Check your BridgeKey wallet…" with cancel.
 *   3. Result  — success (txHash) OR error with retry/cancel.
 *
 * Owner: Pannaga
 */

import { useState } from "react";
import { wallet } from "@/lib/wallet";
import {
  WalletUserRejectedError,
  WalletNetworkError,
  WalletNotInstalledError,
} from "@/lib/wallet/adapter";
import type { WalletAdapter } from "@/lib/wallet/adapter";

// ─────────────────────────────────────────────────────────────────────────────
// Payload types (matching signing_payloads.json)
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnershipRegisterPayload {
  action: "ownership_register";
  file_id: string;
  content_hash: string;
  owner_address: string;
}

export interface PermissionGrantPayload {
  action: "permission_grant";
  file_id: string;
  permission: "read" | "write" | "append" | "admin";
  grantee_address: string;
  expiry_iso: string | null;
  expiry_unix: number | null;
}

export interface PermissionRevokePayload {
  action: "permission_revoke";
  file_id: string;
  grantee_address: string;
}

export interface ApprovalDecisionPayload {
  action: "approval_decision";
  decision: "Approve" | "Reject";
  approval_id: string;
  file_id: string;
}

export type SigningPayload =
  | OwnershipRegisterPayload
  | PermissionGrantPayload
  | PermissionRevokePayload
  | ApprovalDecisionPayload;

// ─────────────────────────────────────────────────────────────────────────────
// Message builder — constructs the human-readable message per spec templates
// ─────────────────────────────────────────────────────────────────────────────

export function buildSigningMessage(payload: SigningPayload): string {
  switch (payload.action) {
    case "ownership_register":
      return (
        `Register ownership of file ${payload.file_id} ` +
        `(hash ${payload.content_hash}) to ${payload.owner_address}`
      );
    case "permission_grant":
      return (
        `Grant ${payload.permission} access on file ${payload.file_id} ` +
        `to ${payload.grantee_address} until ${payload.expiry_iso ?? "no expiry"}`
      );
    case "permission_revoke":
      return `Revoke access on file ${payload.file_id} from ${payload.grantee_address}`;
    case "approval_decision":
      return (
        `${payload.decision} change request ${payload.approval_id} ` +
        `on file ${payload.file_id}`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action display labels
// ─────────────────────────────────────────────────────────────────────────────

function actionTitle(action: SigningPayload["action"]): string {
  switch (action) {
    case "ownership_register": return "Register ownership";
    case "permission_grant":   return "Grant access";
    case "permission_revoke":  return "Revoke access";
    case "approval_decision":  return "Approval decision";
  }
}

function actionIcon(action: SigningPayload["action"]): React.ReactNode {
  // Using inline SVGs (Lucide icons available but keep this self-contained)
  switch (action) {
    case "ownership_register":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "permission_grant":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" />
          <path d="m16 14 2 2 4-4" />
        </svg>
      );
    case "permission_revoke":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" />
          <path d="m18 14-4 4" /><path d="m14 14 4 4" />
        </svg>
      );
    case "approval_decision":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal state
// ─────────────────────────────────────────────────────────────────────────────

type ModalState = "confirm" | "signing" | "success" | "error";

type SigningError =
  | "user_rejected"
  | "wrong_network"
  | "wallet_not_installed"
  | "wallet_disconnected"
  | "unknown";

function errorMessage(code: SigningError): string {
  switch (code) {
    case "user_rejected":       return "Signature declined. You can try again.";
    case "wrong_network":       return "Please switch to MST Testnet in your wallet.";
    case "wallet_not_installed": return "BridgeKey Wallet is not installed.";
    case "wallet_disconnected": return "Wallet disconnected. Please reconnect.";
    case "unknown":             return "An unexpected error occurred. Please try again.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} style={style} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SigningModalProps {
  /** The signing payload driven by signing_payloads.json */
  payload: SigningPayload;
  /** Called when the signature is obtained. txHash comes from backend/contract response. */
  onSuccess: (signature: string) => void;
  /** Called when modal is dismissed without signing */
  onCancel: () => void;
  /** Optional: inject a custom wallet adapter (defaults to lib/wallet index) */
  walletOverride?: WalletAdapter;
  /** Whether the modal is currently open */
  open: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SigningModal component
// ─────────────────────────────────────────────────────────────────────────────

export default function SigningModal({
  payload,
  onSuccess,
  onCancel,
  walletOverride,
  open,
}: SigningModalProps) {
  const [state, setState] = useState<ModalState>("confirm");
  const [errorCode, setErrorCode] = useState<SigningError | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const activeWallet = walletOverride ?? wallet;
  const message = buildSigningMessage(payload);

  const handleSign = async () => {
    setState("signing");
    setErrorCode(null);

    try {
      const sig = await activeWallet.signMessage(message);
      setSignature(sig);
      setState("success");
      onSuccess(sig);
    } catch (err) {
      let code: SigningError = "unknown";
      if (err instanceof WalletUserRejectedError) code = "user_rejected";
      else if (err instanceof WalletNetworkError)    code = "wrong_network";
      else if (err instanceof WalletNotInstalledError) code = "wallet_not_installed";
      else if (err instanceof Error && err.message.toLowerCase().includes("disconnect")) {
        code = "wallet_disconnected";
      }
      setErrorCode(code);
      setState("error");
    }
  };

  const handleRetry = () => {
    setState("confirm");
    setErrorCode(null);
  };

  const handleCancel = () => {
    setState("confirm");
    setErrorCode(null);
    onCancel();
  };

  if (!open) return null;

  const isDestructive =
    payload.action === "permission_revoke" ||
    (payload.action === "approval_decision" && payload.decision === "Reject");

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== "signing") handleCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signing-modal-title"
    >
      {/* Modal */}
      <div
        className="w-full max-w-md rounded-lg shadow-xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{
            borderColor: "var(--border)",
            color: isDestructive ? "var(--danger)" : "var(--accent)",
          }}
        >
          {actionIcon(payload.action)}
          <h2
            id="signing-modal-title"
            className="text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            {actionTitle(payload.action)}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* ── CONFIRM STATE ────────────────────────────────────────────── */}
          {state === "confirm" && (
            <>
              {/* Plain-language summary */}
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                You are about to sign the following action:
              </p>
              <div
                className="rounded-md px-4 py-3 text-sm font-mono mb-5"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  wordBreak: "break-all",
                }}
                aria-label="Signing message"
              >
                {message}
              </div>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
                This will open your BridgeKey wallet to request a signature.
                No gas is required. Signing authorizes the action only — it does not
                send a transaction directly.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Cancel
                </button>
                <button
                  id="signing-modal-sign-btn"
                  type="button"
                  onClick={handleSign}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{
                    background: isDestructive ? "var(--danger)" : "var(--accent)",
                  }}
                >
                  Sign with BridgeKey
                </button>
              </div>
            </>
          )}

          {/* ── SIGNING STATE ────────────────────────────────────────────── */}
          {state === "signing" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Spinner className="w-8 h-8" style={{ color: "var(--accent)" }} />
              <p
                className="text-sm font-medium text-center"
                style={{ color: "var(--text)" }}
                aria-live="polite"
                role="status"
              >
                Check your BridgeKey wallet…
              </p>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                Waiting for signature. This will time out if not confirmed.
              </p>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs underline mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── SUCCESS STATE ────────────────────────────────────────────── */}
          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)" }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success)" }}>
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Signed successfully
              </p>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                The action is being submitted. The on-chain status will update to{" "}
                <span style={{ color: "var(--success)" }}>Verified</span> once confirmed.
              </p>
              {signature && (
                <div
                  className="text-xs font-mono break-all mt-1 px-3 py-2 rounded-sm w-full"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                  title="Signature"
                >
                  {signature.slice(0, 32)}…
                </div>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="mt-2 px-4 py-2 rounded-md text-sm font-medium"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* ── ERROR STATE ──────────────────────────────────────────────── */}
          {state === "error" && errorCode && (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-md px-4 py-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                }}
                role="alert"
                aria-live="assertive"
              >
                <strong>
                  {errorCode === "user_rejected"  && "Signature declined."}
                  {errorCode === "wrong_network"  && "Wrong network."}
                  {errorCode === "wallet_not_installed" && "Wallet not installed."}
                  {errorCode === "wallet_disconnected"  && "Wallet disconnected."}
                  {errorCode === "unknown"        && "Error."}
                </strong>{" "}
                {errorMessage(errorCode)}
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-md text-sm font-medium"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Cancel
                </button>
                {/* Only offer retry for user_rejected (nonce is still valid) */}
                {(errorCode === "user_rejected" || errorCode === "unknown") && (
                  <button
                    id="signing-modal-retry-btn"
                    type="button"
                    onClick={handleRetry}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
