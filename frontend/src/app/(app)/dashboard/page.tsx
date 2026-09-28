"use client";

import IntegrityWidget from "@/components/features/dashboard/integrity-widget";
import { useFiles } from "@/lib/api/hooks/use-files";

export default function Page() {
  const { data: files, isLoading, isError } = useFiles();
  const file = files?.[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Workspace overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Dashboard
        </h1>
      </div>

      {isLoading && (
        <div
          className="rounded-md border p-5 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          Loading integrity status…
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border p-5 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          Integrity status is unavailable right now.
        </div>
      )}

      {file && (
        <IntegrityWidget
          hash={file.hash}
          txHash={file.ownership_tx}
          verification={file.verification}
        />
      )}
    </div>
  );
}
