"use client";
import React, { useState, useEffect } from "react";
import { ApprovalInbox, ApprovalItem } from "@/components/features/approvals/approval-inbox";
import { ApprovalReviewModal } from "@/components/features/approvals/approval-review";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // New approval request modal state
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [targetFileId, setTargetFileId] = useState("f2");
  const [requestComment, setRequestComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const data = await api<ApprovalItem[]>("/approvals");
      setApprovals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleSelectApproval = (item: ApprovalItem) => {
    setSelectedApproval(item);
    setIsReviewOpen(true);
  };

  const handleDecision = async (id: string, decision: "approved" | "rejected", note?: string) => {
    try {
      await api(`/approvals/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      });
      toast("success", `Request ${decision.toUpperCase()}`, `Processed decision for #${id}`);
      loadApprovals();
    } catch (err) {
      toast("error", "Decision Failed", String(err));
    }
  };

  const handleCreateRequest = async () => {
    if (!requestComment) return;
    setIsSubmitting(true);
    try {
      await api("/approvals", {
        method: "POST",
        body: JSON.stringify({
          file_id: targetFileId,
          submitted_by: "u1",
          comment: requestComment,
        }),
      });
      toast("success", "Approval Request Submitted", "Queued for manager review & on-chain audit");
      setIsNewRequestOpen(false);
      setRequestComment("");
      loadApprovals();
    } catch (err) {
      toast("error", "Submission Failed", String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Approval Workflows</h2>
          <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
            Multi-signature workflow inbox for document version updates and protection tier changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadApprovals} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsNewRequestOpen(true)}
          >
            New Approval Request
          </Button>
        </div>
      </div>

      {/* Approval Inbox Component */}
      <ApprovalInbox
        approvals={approvals}
        isLoading={isLoading}
        onSelectApproval={handleSelectApproval}
        onQuickDecision={handleDecision}
      />

      {/* Review Modal */}
      <ApprovalReviewModal
        approval={selectedApproval}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onDecision={handleDecision}
      />

      {/* Create Request Modal */}
      <Modal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        title="Submit New Approval Request"
        description="Initiate an enterprise multi-signature workflow for an existing document."
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsNewRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateRequest}
              isLoading={isSubmitting}
              disabled={!requestComment}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Target Document"
            options={[
              { label: "policy-draft.docx (f2)", value: "f2" },
              { label: "Q3-contract.pdf (f1)", value: "f1" },
            ]}
            value={targetFileId}
            onChange={(e) => setTargetFileId(e.target.value)}
          />

          <Input
            label="Reason / Note"
            placeholder="e.g., Updated section 4 confidentiality clauses"
            value={requestComment}
            onChange={(e) => setRequestComment(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
