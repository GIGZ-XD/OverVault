"use client";
import React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionPill } from "@/components/ui/permission-pill";
import { formatDate } from "@/lib/utils";
import { Trash2, UserCheck, Clock, Key } from "lucide-react";

export interface PermissionGrant {
  id: string;
  file_id: string;
  grantee: string;
  permission: string;
  expires_at: string;
  status: "active" | "expired" | "revoked" | string;
}

export interface GrantsTableProps {
  grants: PermissionGrant[];
  isLoading?: boolean;
  onRevoke: (grant: PermissionGrant) => Promise<void>;
}

export function GrantsTable({ grants, isLoading, onRevoke }: GrantsTableProps) {
  const columns: Column<PermissionGrant>[] = [
    {
      header: "Grantee User ID",
      accessorKey: "grantee",
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs flex items-center justify-center font-bold border border-indigo-500/30">
            {item.grantee.toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-text text-sm font-mono">{item.grantee}</span>
            <span className="text-[11px] text-text-muted block">File ID: {item.file_id}</span>
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
        <span className="font-mono text-xs text-text-muted flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-text-dim" />
          {formatDate(item.expires_at)}
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

  return <DataTable columns={columns} data={grants} keyExtractor={(g) => g.id} isLoading={isLoading} />;
}
