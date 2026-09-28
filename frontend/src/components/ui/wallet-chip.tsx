"use client";

/**
 * WalletChip — displays a wallet address with truncation, copy, and network badge.
 *
 * Per DESIGN.md:
 *   "Truncated address, network badge, dropdown with Disconnect."
 *   Mono font, sm radius (6px).
 *
 * Owner: Pannaga
 */

import { useState } from "react";

interface WalletChipProps {
  /** Full wallet address (e.g. "0xaaa1...ffff") */
  address: string;
  /** Network display name (e.g. "MST Testnet") */
  network?: string;
  /** Called when user clicks Disconnect in dropdown */
  onDisconnect?: () => void;
  /** Extra CSS class */
  className?: string;
}

/** Truncate an address to "0x1234…abcd" */
function truncateAddress(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function CopyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function WalletChip({
  address,
  network = "MST Testnet",
  onDisconnect,
  className = "",
}: WalletChipProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDisconnect = () => {
    setOpen(false);
    onDisconnect?.();
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Main chip button */}
      <button
        id="wallet-chip-btn"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Wallet: ${address}`}
        title={address}
        className="inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-mono transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        {/* Network dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: "var(--success)" }}
          aria-hidden="true"
        />

        {/* Truncated address */}
        <span className="font-mono">{truncateAddress(address)}</span>

        {/* Network badge */}
        <span
          className="rounded-full px-1.5 py-0.5 text-xs font-sans font-medium"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          {network}
        </span>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy address"
          className="ml-0.5 p-0.5 rounded transition-opacity hover:opacity-70 focus:outline-none"
          style={{ color: "var(--text-muted)" }}
        >
          {copied ? (
            <CheckIcon className="w-3.5 h-3.5" style={{ color: "var(--success)" } as React.CSSProperties} />
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </button>

        <ChevronDownIcon
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md shadow-md py-1"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
            role="menu"
          >
            {/* Full address (read-only) */}
            <div
              className="px-3 py-2 text-xs font-mono break-all"
              style={{ color: "var(--text-muted)" }}
            >
              {address}
            </div>
            <hr style={{ borderColor: "var(--border)" }} />
            {onDisconnect && (
              <button
                type="button"
                onClick={handleDisconnect}
                role="menuitem"
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-80 focus:outline-none"
                style={{ color: "var(--danger)" }}
              >
                Disconnect
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
