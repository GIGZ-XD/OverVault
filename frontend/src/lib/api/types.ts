/** Frontend shapes matching the merged backend Pydantic schemas. */

export type Role = "employee" | "manager" | "admin" | "auditor";
export type ProtectionMode = "none" | "append_only" | "read_only" | "read-only" | "append-only";
export type PermissionLevel = "read" | "write" | "manage" | "append" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PermissionStatus = "active" | "revoked" | "expired";
export type Verification = "verified" | "pending" | "tampered";

export interface UserOut {
  id: string;
  email?: string;
  name: string;
  role: Role;
  wallet_address: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: UserOut;
}

export interface WalletNonceResponse {
  nonce: string;
  message: string;
}

export interface WalletVerifyBody {
  address: string;
  signature: string;
}

export interface FileOut {
  id: string;
  name: string;
  owner: string;
  size: number;
  protection: ProtectionMode;
  verification: string;
  hash: string;
  ownership_tx: string | null;
  content_type: string;
  current_version: number;
  approved_version: number | null;
  created_at: string;
  updated_at: string;
  my_access: PermissionLevel | null;
}

export type FileSummary = FileOut;

export interface VerifyResult {
  file_id: string;
  local_hash: string;
  chain_hash: string;
  verified: boolean;
  timestamp: string;
}

export interface DashboardSummary {
  total_files: number;
  verified_files: number;
  pending_approvals: number;
  active_permissions: number;
  integrity_score: string;
  blockchain_status: string;
}

export interface VersionOut {
  id: string;
  file_id: string;
  version_number: number;
  sha256: string;
  size_bytes: number;
  author_id: string;
  comment: string;
  rolled_back_from: number | null;
  created_at: string;
}

export interface PermissionOut {
  id: string;
  file_id: string;
  grantee: string;
  permission: PermissionLevel;
  status: PermissionStatus | string;
  expires_at: string | null;
  granted_by: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface GrantRequestBody {
  grantee: string;
  permission: PermissionLevel;
  expires_at?: string | null;
  signature?: string | null;
}

export interface ApprovalOut {
  id: string;
  file_id: string;
  version_number: number;
  submitted_by: string;
  reviewer_id: string | null;
  status: ApprovalStatus;
  comment: string;
  request_comment: string;
  decision_comment: string;
  created_at: string;
  decided_at: string | null;
}

export interface ApprovalSubmitBody {
  file_id: string;
  version_number?: number | null;
  comment?: string;
}

export interface ApprovalDecisionBody {
  decision: "approved" | "rejected";
  comment?: string;
  signature?: string | null;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  reference_id?: string;
  file_id?: string;
  actor: string;
  payload?: Record<string, unknown> | null;
  status?: string;
  verification?: Verification;
  tx_hash: string | null;
  created_at?: string;
  timestamp?: number;
}

export interface ApiErrorBody {
  detail: string;
  code?: string;
}
