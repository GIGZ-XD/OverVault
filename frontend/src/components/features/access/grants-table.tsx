"use client";
import React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionPill } from "@/components/ui/permission-pill";
import { formatDate, shortHash } from "@/lib/utils";
import { Trash2, UserCheck, Clock, Key, KeyRound, ExternalLink } from "lucide-react";

export interface PermissionGrant {
  id: string;
  file_id: string;
  file_name?: string;
  grantee: string;
  grantee_name?: string;
  permission: string;
  expires_at?: string | null;
  status: "active" | "expired" | "revoked" | string;
  granted_by?: string;
  created_at?: string;
  tx_hash?: string | null;
}

export interface GrantsTableProps {
  grants: PermissionGrant[];
  isLoading?: boolean;
  onRevoke: (grant: PermissionGrant) => Promise<void>;
}

export function GrantsTable({ grants, isLoading, onRevoke }: GrantsTableProps) {
  const columns: Column<PermissionGrant>[] = [
    {
      header: "Grantee & Target Document",
      accessorKey: "grantee",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-mono text-xs flex items-center justify-center font-bold border border-primary/20 shrink-0">
            {item.grantee_name
              ? item.grantee_name.slice(0, 2).toUpperCase()
              : item.grantee.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink text-sm">
                {item.grantee_name || item.grantee}
              </span>
              <span className="text-[11px] font-mono text-ink-muted-48 bg-card px-1.5 py-0.5 rounded border border-hairline">
                {item.grantee}
              </span>
            </div>
            <span className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
              {item.file_name ? item.file_name : `File ID: ${item.file_id}`}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Permission Level",
      cell: (item) => <PermissionPill permission={item.permission} />,
    },
    {
      header: "Expiration Date",
      cell: (item) => (
        <span className="font-mono text-xs text-ink-muted-48 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-ink-muted-48 shrink-0" />
          {item.expires_at ? formatDate(item.expires_at) : "Permanent"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (item) => {
        const s = item.status.toLowerCase();
        if (s === "active") return <Badge variant="active">Active</Badge>;
        if (s === "expired") return <Badge variant="expired">Expired</Badge>;
        return <Badge variant="revoked">Revoked</Badge>;
      },
    },
    {
      header: "MST Transaction",
      className: "whitespace-nowrap",
      cell: (item) =>
        item.tx_hash ? (
          <a
            href={`https://mstscan.io/tx/${item.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Inspect Permission Grant on MSTScan"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-[6px] border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            {shortHash(item.tx_hash)}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted-48 bg-parchment px-2 py-0.5 rounded-[6px] border border-hairline">
            Anchored
          </span>
        ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (item) => (
        <div className="flex justify-end">
          {item.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRevoke(item)}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
              className="text-xs h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
            >
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={grants}
      keyExtractor={(g) => g.id}
      isLoading={isLoading}
      emptyState={
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-parchment flex items-center justify-center text-ink-muted-48 border border-hairline">
            <KeyRound className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-ink">No active permission grants</p>
          <p className="text-xs text-ink-muted-48 max-w-sm">
            Click &ldquo;Grant Access&rdquo; to issue cryptographically verifiable document permissions to team members.
          </p>
        </div>
      }
    />
  );
}
