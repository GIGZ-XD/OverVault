"use client";

import { useMemo, useState } from "react";
import AuditFilters from "@/components/features/audit/audit-filters";
import AuditTable from "@/components/features/audit/audit-table";
import { useAudit } from "@/lib/api/hooks/useAudit";

export default function Page() {
  const { data: events = [], isLoading, isError } = useAudit();
  const [query, setQuery] = useState("");
  const [verification, setVerification] = useState<"all" | "verified" | "pending" | "tampered">("all");
  const [action, setAction] = useState("all");

  const actions = useMemo(
    () => Array.from(new Set(events.map((event) => event.event_type))).sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        event.actor.toLowerCase().includes(normalizedQuery) ||
        event.file_id?.toLowerCase().includes(normalizedQuery) ||
        event.event_type.toLowerCase().includes(normalizedQuery);
      const matchesVerification = verification === "all" || event.verification === verification;
      const matchesAction = action === "all" || event.event_type === action;
      return matchesQuery && matchesVerification && matchesAction;
    });
  }, [action, events, query, verification]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Proof of workspace activity
        </p>
        <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Audit trail
        </p>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Review who changed each resource, when it happened, and whether the chain record is verified.
        </p>
      </header>

      <AuditFilters
        query={query}
        verification={verification}
        actions={actions}
        action={action}
        onQueryChange={setQuery}
        onVerificationChange={setVerification}
        onActionChange={setAction}
      />

      <AuditTable events={filteredEvents} isLoading={isLoading} isError={isError} />
    </div>
  );
}
