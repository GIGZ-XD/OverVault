"use client";
import React, { useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckSquare } from "lucide-react";

export interface ApprovalItem {
  id: string;
  file_id: string;
  submitted_by: string;
  status: "pending" | "approved" | "rejected" | string;
  comment: string;
}

export interface ApprovalInboxProps {
  approvals: ApprovalItem[];
  isLoading?: boolean;
  onSelectApproval: (approval: ApprovalItem) => void;
  onQuickDecision?: (id: string, decision: "approved" | "rejected") => void;
}

export function ApprovalInbox({
  approvals,
  isLoading,
  onSelectApproval,
  onQuickDecision,
}: ApprovalInboxProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const filteredApprovals = approvals.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const columns: Column<ApprovalItem>[] = [
    {
      header: "Approval Request",
      accessorKey: "id",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-parchment text-warning border border-hairline shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span
              onClick={() => onSelectApproval(item)}
              className="font-semibold text-ink hover:text-primary cursor-pointer block text-sm"
            >
              Request #{item.id}
            </span>
            <span className="text-[11px] text-ink-muted-48 font-mono block">
              File: {item.file_id} • By {item.submitted_by}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Submission Note / Reason",
      cell: (item) => (
        <span className="text-xs text-ink-muted-48 italic max-w-xs truncate block font-normal">
          {item.comment}
        </span>
      ),
    },
    {
      header: "Status",
      className: "whitespace-nowrap",
      cell: (item) => {
        const s = item.status.toLowerCase();
        if (s === "approved") return <Badge variant="verified">Approved</Badge>;
        if (s === "rejected") return <Badge variant="tampered">Rejected</Badge>;
        return <Badge variant="pending">Pending Review</Badge>;
      },
    },
    {
      header: "Actions",
      className: "text-right whitespace-nowrap",
      cell: (item) => (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            onClick={() => onSelectApproval(item)}
            className="text-xs px-3 h-7 font-normal"
          >
            Review
          </Button>

          {item.status === "pending" && onQuickDecision && (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={() => onQuickDecision(item.id, "approved")}
                className="text-xs px-3.5 h-7 font-normal"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onQuickDecision(item.id, "rejected")}
                className="text-xs px-3.5 h-7 font-normal"
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Apple Segmented Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "all", "approved", "rejected"] as const).map((tab) => {
          const count =
            tab === "all"
              ? approvals.length
              : approvals.filter((a) => a.status === tab).length;
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all duration-150 select-none ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-parchment text-ink-muted-80 hover:text-ink hover:bg-parchment/80 border border-hairline"
              }`}
            >
              {tab} Requests ({count})
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={filteredApprovals}
        keyExtractor={(a) => a.id}
        isLoading={isLoading}
        onRowClick={onSelectApproval}
        emptyState={
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-parchment flex items-center justify-center text-ink-muted-48 border border-hairline">
              <CheckSquare className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-ink">No approval workflows found</p>
            <p className="text-xs text-ink-muted-48 max-w-sm">
              When document updates or protection tier changes are initiated, they will appear here for multi-signature review.
            </p>
          </div>
        }
      />
    </div>
  );
}

export default ApprovalInbox;
