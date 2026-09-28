"use client";
import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiffViewer, DiffLine } from "@/components/ui/diff-viewer";
import { CheckCircle2, XCircle, FileText, User, MessageSquare, Shield } from "lucide-react";
import { ApprovalItem } from "@/components/features/approvals/approval-inbox";

export interface ApprovalReviewModalProps {
  approval: ApprovalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDecision: (id: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
}

export function ApprovalReviewModal({
  approval,
  isOpen,
  onClose,
  onDecision,
}: ApprovalReviewModalProps) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!approval) return null;

  const sampleDiffLines: DiffLine[] = [
    { type: "normal", content: '{\n  "document_title": "Enterprise Storage Policy",', lineNumberOld: 1, lineNumberNew: 1 },
    { type: "remove", content: '  "protection_tier": "none",', lineNumberOld: 2 },
    { type: "add", content: '  "protection_tier": "read-only",', lineNumberNew: 2 },
    { type: "normal", content: '  "blockchain_verification": true\n}', lineNumberOld: 3, lineNumberNew: 3 },
  ];

  const handleAction = async (decision: "approved" | "rejected") => {
    setIsSubmitting(true);
    try {
      await onDecision(approval.id, decision, note);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Approval Request #${approval.id}`}
      description="Compare proposed changes and submit on-chain decision."
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          {approval.status === "pending" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                isLoading={isSubmitting}
                onClick={() => handleAction("rejected")}
                leftIcon={<XCircle className="w-4 h-4" />}
              >
                Reject Request
              </Button>
              <Button
                variant="success"
                isLoading={isSubmitting}
                onClick={() => handleAction("approved")}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Approve & Commit
              </Button>
            </div>
          ) : (
            <Badge variant={approval.status === "approved" ? "verified" : "tampered"}>
              Decision: {approval.status.toUpperCase()}
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Request Header Info */}
        <div className="p-4 rounded-xl border border-border bg-surface-2/40 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text">Target File: {approval.file_id}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <User className="w-3.5 h-3.5 text-text-dim" />
              <span>Submitted by: <strong className="text-text font-mono">{approval.submitted_by}</strong></span>
            </div>
          </div>
          <Badge variant={approval.status === "approved" ? "verified" : approval.status === "rejected" ? "tampered" : "pending"}>
            {approval.status}
          </Badge>
        </div>

        {/* Comment Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-accent" /> Submitter Note
          </label>
          <div className="p-3 rounded-lg border border-border bg-surface-2 text-xs text-text font-mono italic">
            &ldquo;{approval.comment}&rdquo;
          </div>
        </div>

        {/* Proposed Changes Diff Viewer */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted">Proposed Changes Comparison</label>
          <DiffViewer lines={sampleDiffLines} />
        </div>

        {/* Reviewer Note Input */}
        {approval.status === "pending" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted">Reviewer Decision Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Approved following security compliance audit..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
