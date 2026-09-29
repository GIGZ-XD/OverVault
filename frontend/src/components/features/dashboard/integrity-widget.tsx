import HashChip from "@/components/ui/hash-chip";
import TxLink from "@/components/ui/tx-link";
import type { Verification } from "@/lib/api/types";

interface IntegrityWidgetProps {
  hash: string;
  txHash: string | null;
  verification: Verification;
}

const verificationLabel: Record<Verification, string> = {
  verified: "Verified on chain",
  pending: "Verification pending",
  tampered: "Verification failed",
};

export default function IntegrityWidget({
  hash,
  txHash,
  verification,
}: IntegrityWidgetProps) {
  const color =
    verification === "verified"
      ? "var(--success)"
      : verification === "pending"
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <section
      className="rounded-md border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      aria-labelledby="integrity-widget-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            id="integrity-widget-title"
            className="text-sm font-semibold"
            style={{ color: "var(--text)" }}
          >
            Integrity health
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Latest file commitment and chain reference
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-xs font-medium"
          style={{ background: "var(--surface-2)", color }}
        >
          {verificationLabel[verification]}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs" style={{ color: "var(--text-muted)" }}>
            Content hash
          </dt>
          <dd className="mt-2">
            <HashChip hash={hash} status={verification} />
          </dd>
        </div>
        <div>
          <dt className="text-xs" style={{ color: "var(--text-muted)" }}>
            Transaction reference
          </dt>
          <dd className="mt-2">
            <TxLink txHash={txHash} pending={verification === "pending"} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
