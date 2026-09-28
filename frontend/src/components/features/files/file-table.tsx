"use client";
import React from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, shortHash } from "@/lib/utils";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Share2,
  CheckSquare,
} from "lucide-react";

export interface VaultFile {
  id: string;
  name: string;
  owner: string;
  size: number;
  protection: "none" | "read-only" | "append-only" | string;
  verification: "verified" | "pending" | "tampered" | string;
  hash: string;
  ownership_tx?: string | null;
}

export interface FileTableProps {
  files: VaultFile[];
  isLoading?: boolean;
  onSelectFile: (file: VaultFile) => void;
  onDownload: (file: VaultFile) => void;
  onDelete?: (file: VaultFile) => void;
  onGrantAccess?: (file: VaultFile) => void;
  onRequestApproval?: (file: VaultFile) => void;
}

export function FileTable({
  files,
  isLoading,
  onSelectFile,
  onDownload,
  onDelete,
  onGrantAccess,
  onRequestApproval,
}: FileTableProps) {
  const columns: Column<VaultFile>[] = [
    {
      header: "Document Name",
      accessorKey: "name",
      cell: (file) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-parchment text-primary border border-hairline shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span
              onClick={() => onSelectFile(file)}
              className="font-semibold text-ink hover:text-primary hover:underline cursor-pointer block text-sm"
            >
              {file.name}
            </span>
            <span className="text-[11px] text-ink-muted-48 font-mono block">ID: {file.id}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Cryptographic Hash",
      className: "whitespace-nowrap",
      cell: (file) => (
        <span className="font-mono text-xs text-ink-muted-48 bg-parchment px-2 py-0.5 rounded-[6px] border border-hairline whitespace-nowrap">
          {shortHash(file.hash)}
        </span>
      ),
    },
    {
      header: "Size",
      className: "whitespace-nowrap",
      cell: (file) => (
        <span className="font-mono text-xs text-ink-muted-48 whitespace-nowrap">
          {formatBytes(file.size)}
        </span>
      ),
    },
    {
      header: "Protection",
      className: "whitespace-nowrap",
      cell: (file) => {
        const p = file.protection.toLowerCase();
        if (p === "read-only") return <Badge variant="read-only">Read-Only</Badge>;
        if (p === "append-only") return <Badge variant="append-only">Append-Only</Badge>;
        return <Badge variant="default">Standard</Badge>;
      },
    },
    {
      header: "Chain Integrity",
      className: "whitespace-nowrap",
      cell: (file) => {
        const v = file.verification.toLowerCase();
        if (v === "verified") return <Badge variant="verified">Verified</Badge>;
        if (v === "tampered") return <Badge variant="tampered">Tampered</Badge>;
        return <Badge variant="pending">Pending</Badge>;
      },
    },
    {
      header: "Actions",
      className: "text-right whitespace-nowrap",
      cell: (file) => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            title="Inspect File Details"
            onClick={() => onSelectFile(file)}
            className="p-1.5 h-8 w-8"
          >
            <Eye className="w-3.5 h-3.5 text-ink-muted-48 hover:text-ink" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            title="Download & Verify"
            onClick={() => onDownload(file)}
            className="p-1.5 h-8 w-8"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted-48 hover:text-primary" />
          </Button>

          {onGrantAccess && (
            <Button
              size="sm"
              variant="ghost"
              title="Grant Access"
              onClick={() => onGrantAccess(file)}
              className="p-1.5 h-8 w-8"
            >
              <Share2 className="w-3.5 h-3.5 text-ink-muted-48 hover:text-primary" />
            </Button>
          )}

          {onRequestApproval && (
            <Button
              size="sm"
              variant="ghost"
              title="Request Approval"
              onClick={() => onRequestApproval(file)}
              className="p-1.5 h-8 w-8"
            >
              <CheckSquare className="w-3.5 h-3.5 text-ink-muted-48 hover:text-warning" />
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              title="Delete Document"
              onClick={() => onDelete(file)}
              className="p-1.5 h-8 w-8"
            >
              <Trash2 className="w-3.5 h-3.5 text-ink-muted-48 hover:text-danger" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={files}
      keyExtractor={(f) => f.id}
      isLoading={isLoading}
      onRowClick={onSelectFile}
    />
  );
}

export default FileTable;
