"use client";

/**
 * TxLink — displays a transaction hash as a chip with an external link to MSTScan.
 *
 * Per DESIGN.md:
 *   "Chip with external-link icon, opens the transaction on MSTScan in a new tab."
 *   Transaction links should point to MSTScan when a transaction hash is available.
 *   Do NOT fabricate transaction hashes.
 *
 * Owner: Pannaga
 */

import { config } from "@/lib/config";

interface TxLinkProps {
  /** Full transaction hash — MUST be a real hash from the chain, never fabricated. */
  txHash: string | null | undefined;
  /** Override MSTScan base URL (uses config.mstscanBaseUrl by default) */
  mstscanBaseUrl?: string;
  /** Extra CSS class */
  className?: string;
  /** Show "Pending" badge when hash is not yet available */
  pending?: boolean;
}

function truncateTxHash(hash: string, prefix = 8, suffix = 6): string {
  if (hash.length <= prefix + suffix + 1) return hash;
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function TxLink({
  txHash,
  mstscanBaseUrl,
  className = "",
  pending = false,
}: TxLinkProps) {
  const baseUrl = mstscanBaseUrl ?? config.mstscanBaseUrl;

  // No hash yet — show pending state
  if (!txHash) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-mono ${className}`}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--warning)",
        }}
        aria-label="Transaction pending"
      >
        <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{pending ? "Pending…" : "No tx"}</span>
      </span>
    );
  }

  // Hash available — link to MSTScan
  const href = baseUrl ? `${baseUrl}/tx/${txHash}` : undefined;
  const truncated = truncateTxHash(txHash);

  const chipContent = (
    <>
      <span className="font-mono">{truncated}</span>
      <ExternalLinkIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
    </>
  );

  const chipClass = `inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 ${className}`;
  const chipStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--info)",
    focusRingColor: "var(--accent)",
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View transaction ${txHash} on MSTScan (opens in new tab)`}
        title={txHash}
        className={chipClass}
        style={chipStyle}
      >
        {chipContent}
      </a>
    );
  }

  // MSTScan URL not configured — show chip without link (still not fabricated)
  return (
    <span
      className={chipClass}
      title={txHash}
      aria-label={`Transaction: ${txHash}`}
      style={chipStyle}
    >
      {chipContent}
    </span>
  );
}
