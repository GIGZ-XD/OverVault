"use client";
import React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortHash, formatDate } from "@/lib/utils";
import {
  FileText,
  ShieldCheck,
  Upload,
  Lock,
  KeyRound,
  UserMinus,
  CheckSquare,
  XSquare,
  Download,
  ExternalLink,
  Hash,
} from "lucide-react";

export interface AuditEvent {
  id: string;
  event_type: string;
  file_id: string;
  file_name?: string;
  actor: string;
  actor_name?: string;
  tx_hash: string | null;
  verification: "verified" | "pending" | "tampered" | string;
  timestamp: number;
  detail?: string;
}

export interface AuditTableProps {
  events: AuditEvent[];
  isLoading?: boolean;
  onSelectEvent?: (event: AuditEvent) => void;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  ownership_register: <Upload className="w-3.5 h-3.5" />,
  version_update: <FileText className="w-3.5 h-3.5" />,
  access_grant: <KeyRound className="w-3.5 h-3.5" />,
  access_revoke: <UserMinus className="w-3.5 h-3.5" />,
  hash_verification: <ShieldCheck className="w-3.5 h-3.5" />,
  protection_change: <Lock className="w-3.5 h-3.5" />,
  approval_submitted: <CheckSquare className="w-3.5 h-3.5" />,
  approval_decision: <XSquare className="w-3.5 h-3.5" />,
  file_download: <Download className="w-3.5 h-3.5" />,
};

const EVENT_LABELS: Record<string, string> = {
  ownership_register: "Ownership Registered",
  version_update: "Version Update",
  access_grant: "Access Granted",
  access_revoke: "Access Revoked",
  hash_verification: "Hash Verification",
  protection_change: "Protection Changed",
  approval_submitted: "Approval Submitted",
  approval_decision: "Approval Decision",
  file_download: "File Download",
};

export function AuditTable({ events, isLoading, onSelectEvent }: AuditTableProps) {
  const columns: Column<AuditEvent>[] = [
    {
      header: "Event",
      cell: (event) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-parchment text-primary border border-hairline shrink-0">
            {EVENT_ICONS[event.event_type] || <Hash className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="font-semibold text-ink text-sm block">
              {EVENT_LABELS[event.event_type] || event.event_type}
            </span>
            {event.detail && (
              <span className="text-[11px] text-ink-muted-48 font-normal block max-w-xs truncate">
                {event.detail}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Document",
      cell: (event) => (
        <div>
          <span className="text-sm text-ink font-normal block">{event.file_name || event.file_id}</span>
          <span className="text-[11px] text-ink-muted-48 font-mono block">{event.file_id}</span>
        </div>
      ),
    },
    {
      header: "Actor",
      cell: (event) => (
        <div>
          <span className="text-sm text-ink font-normal block">{event.actor_name || "—"}</span>
          <span className="text-[11px] text-ink-muted-48 font-mono block">{shortHash(event.actor)}</span>
        </div>
      ),
    },
    {
      header: "Timestamp",
      className: "whitespace-nowrap",
      cell: (event) => (
        <span className="text-xs text-ink-muted-48 font-normal whitespace-nowrap">
          {formatDate(event.timestamp)}
        </span>
      ),
    },
    {
      header: "Tx Hash",
      className: "whitespace-nowrap",
      cell: (event) =>
        event.tx_hash ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary bg-primary/8 px-2 py-0.5 rounded-[6px] border border-primary/15 whitespace-nowrap cursor-pointer hover:bg-primary/15 transition-colors duration-150">
            {shortHash(event.tx_hash)}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </span>
        ) : (
          <span className="text-xs text-ink-muted-48 font-normal">—</span>
        ),
    },
    {
      header: "Status",
      className: "whitespace-nowrap",
      cell: (event) => {
        const v = event.verification?.toLowerCase();
        if (v === "verified") return <Badge variant="verified">Verified</Badge>;
        if (v === "tampered") return <Badge variant="tampered">Tampered</Badge>;
        return <Badge variant="pending">Pending</Badge>;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={events}
      keyExtractor={(e) => e.id}
      isLoading={isLoading}
      onRowClick={onSelectEvent}
      emptyState="No audit events found. Actions on documents will appear here."
    />
  );
}

export default AuditTable;
