import WalletChip from "@/components/ui/wallet-chip";
import TxLink from "@/components/ui/tx-link";
import type { AuditEvent, Verification } from "@/lib/api/types";

interface AuditTableProps {
  events: AuditEvent[];
  isLoading?: boolean;
  isError?: boolean;
}

const verificationLabel: Record<Verification, string> = {
  verified: "Verified",
  pending: "Pending",
  tampered: "Failed",
};

const verificationColor: Record<Verification, string> = {
  verified: "var(--success)",
  pending: "var(--warning)",
  tampered: "var(--danger)",
};

export default function AuditTable({ events, isLoading = false, isError = false }: AuditTableProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-md border p-6 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        role="status"
      >
        Loading audit events…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-md border p-6 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--danger)", color: "var(--danger)" }}
        role="alert"
      >
        Audit events could not be loaded.
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="rounded-md border p-8 text-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          No audit events found
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Try changing the filters or check back after the next workspace action.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
      <table className="min-w-[900px] w-full text-left text-sm">
        <caption className="sr-only">Audit events</caption>
        <thead style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
          <tr className="text-xs uppercase tracking-wide">
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Actor</th>
            <th className="px-4 py-3 font-medium">Resource</th>
            <th className="px-4 py-3 font-medium">Timestamp</th>
            <th className="px-4 py-3 font-medium">Outcome</th>
            <th className="px-4 py-3 font-medium">Transaction</th>
          </tr>
        </thead>
        <tbody style={{ background: "var(--surface)", color: "var(--text)" }}>
          {events.map((event) => (
            <tr key={event.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-4 py-4 font-medium">{formatAction(event.event_type)}</td>
              <td className="px-4 py-4">
                <WalletChip address={event.actor} />
              </td>
              <td className="px-4 py-4 font-mono text-xs">{event.file_id}</td>
              <td className="whitespace-nowrap px-4 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
                {formatTimestamp(event.timestamp)}
              </td>
              <td className="px-4 py-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
                  style={{ background: "var(--surface-2)", color: verificationColor[event.verification] }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: verificationColor[event.verification] }} />
                  {verificationLabel[event.verification]}
                </span>
              </td>
              <td className="px-4 py-4">
                <TxLink txHash={event.tx_hash} pending={event.verification === "pending"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(timestamp: number): string {
  return `${new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
