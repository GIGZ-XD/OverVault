"use client";

/**
 * HashChip — displays a content/file hash with truncation, copy, and full-value tooltip.
 *
 * Per DESIGN.md:
 *   "Mono text truncated as 0x9f3a…c21e, copy icon, tooltip with full value."
 *   Mono font, sm radius (6px).
 *
 * Owner: Pannaga
 */

import { useState } from "react";

interface HashChipProps {
  /** Full hex hash or 0x-prefixed string */
  hash: string;
  /** Number of chars to show at start (default 6) */
  prefixLen?: number;
  /** Number of chars to show at end (default 4) */
  suffixLen?: number;
  /** Extra CSS class */
  className?: string;
  /** Optional: verification state drives color */
  status?: "verified" | "pending" | "tampered" | "none";
}

/** Returns CSS color var for a given status */
function statusColor(status: HashChipProps["status"]): string {
  switch (status) {
    case "verified": return "var(--success)";
    case "pending":  return "var(--warning)";
    case "tampered": return "var(--danger)";
    default:         return "var(--text-muted)";
  }
}

function truncateHash(hash: string, prefix = 6, suffix = 4): string {
  if (hash.length <= prefix + suffix + 1) return hash;
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
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

export default function HashChip({
  hash,
  prefixLen = 6,
  suffixLen = 4,
  className = "",
  status = "none",
}: HashChipProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncated = truncateHash(hash, prefixLen, suffixLen);

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-mono ${className}`}
      style={{
        background: "var(--surface-2)",
        border: `1px solid var(--border)`,
        color: statusColor(status),
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Hash text */}
      <span
        aria-label={`Hash: ${hash}`}
        role="text"
      >
        {truncated}
      </span>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy hash"
        className="p-0.5 rounded transition-opacity hover:opacity-70 focus:outline-none"
        style={{ color: "var(--text-muted)" }}
      >
        {copied ? (
          <CheckIcon className="w-3 h-3" style={{ color: "var(--success)" }} />
        ) : (
          <CopyIcon className="w-3 h-3" />
        )}
      </button>

      {/* Tooltip with full value */}
      {showTooltip && hash.length > prefixLen + suffixLen + 1 && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-1.5 z-30 max-w-xs rounded-md px-2.5 py-1.5 text-xs font-mono break-all shadow-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            whiteSpace: "normal",
            minWidth: "200px",
          }}
        >
          {hash}
        </div>
      )}
    </div>
  );
}
