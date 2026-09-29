interface AuditFiltersProps {
  query: string;
  verification: "all" | "verified" | "pending" | "tampered";
  actions: string[];
  action: string;
  onQueryChange: (query: string) => void;
  onVerificationChange: (verification: AuditFiltersProps["verification"]) => void;
  onActionChange: (action: string) => void;
}

export default function AuditFilters({
  query,
  verification,
  actions,
  action,
  onQueryChange,
  onVerificationChange,
  onActionChange,
}: AuditFiltersProps) {
  return (
    <div
      className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_180px_220px]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      aria-label="Audit filters"
    >
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Search events
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search actor or file"
          className="mt-1 block h-10 w-full rounded-sm border px-3 text-sm outline-none focus:ring-2"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
      </label>

      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Verification
        <select
          value={verification}
          onChange={(event) =>
            onVerificationChange(event.target.value as AuditFiltersProps["verification"])
          }
          className="mt-1 block h-10 w-full rounded-sm border px-3 text-sm outline-none focus:ring-2"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <option value="all">All states</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="tampered">Failed</option>
        </select>
      </label>

      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Action
        <select
          value={action}
          onChange={(event) => onActionChange(event.target.value)}
          className="mt-1 block h-10 w-full rounded-sm border px-3 text-sm outline-none focus:ring-2"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <option value="all">All actions</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {formatAction(item)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
