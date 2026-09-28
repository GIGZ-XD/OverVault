"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { ApprovalDecisionBody, ApprovalOut, ApprovalStatus, ApprovalSubmitBody } from "../types";

/** scope: "inbox" (reviewers) or "mine" (my own requests) - defaults server-side by role. */
export function useApprovals(scope?: "inbox" | "mine", status?: ApprovalStatus) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (status) params.set("status", status);
  const qs = params.toString();
  return useQuery({
    queryKey: qk.approvals(scope, status),
    queryFn: () => api.get<ApprovalOut[]>(`/approvals${qs ? `?${qs}` : ""}`),
  });
}

export function useApproval(approvalId: string | undefined) {
  return useQuery({
    queryKey: qk.approval(approvalId ?? ""),
    queryFn: () => api.get<ApprovalOut>(`/approvals/${approvalId}`),
    enabled: !!approvalId,
  });
}

/** POST /approvals - flat path, file_id travels in the body (see ADR 0005). */
export function useSubmitApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApprovalSubmitBody) => api.post<ApprovalOut>("/approvals", body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: qk.file(data.file_id) });
    },
  });
}

/** POST /approvals/{id}/decision - one endpoint with a decision field (see ADR 0005), not separate approve/reject. */
export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, body }: { approvalId: string; body: ApprovalDecisionBody }) =>
      api.post<ApprovalOut>(`/approvals/${approvalId}/decision`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: qk.file(data.file_id) });
    },
  });
}
