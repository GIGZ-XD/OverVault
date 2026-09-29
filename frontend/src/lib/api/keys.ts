/** Central React Query key factory, so every hook and every invalidation agree. */

export const qk = {
  me: ["me"] as const,
  users: ["users"] as const,
  files: ["files"] as const,
  file: (fileId: string) => ["files", fileId] as const,
  versions: (fileId: string) => ["files", fileId, "versions"] as const,
  permissions: (fileId: string) => ["files", fileId, "permissions"] as const,
  approvals: (scope?: string, status?: string) =>
    ["approvals", scope ?? null, status ?? null] as const,
  approval: (approvalId: string) => ["approvals", approvalId] as const,
  dashboard: ["dashboard", "summary"] as const,
};
