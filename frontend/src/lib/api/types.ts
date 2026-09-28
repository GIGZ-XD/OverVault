/**
 * Mirrors the backend's Pydantic schemas exactly (field names/casing match the
 * JSON the API sends, which is the resolved contract from ADR 0005). Kept as
 * plain interfaces - no runtime validation library is in package.json yet.
 * Regenerate/diff this by hand whenever specs/openapi.yaml changes.
 */

export type Role = "employee" | "manager" | "admin" | "auditor";
export type ProtectionMode = "none" | "append_only" | "read_only";
export type PermissionLevel = "read" | "write" | "manage";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PermissionStatus = "active" | "revoked" | "expired";

// ---- auth ----

export interface UserOut {
  id: string;
  email: string;
  name: string;
  role: Role;
  wallet_address: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface WalletNonceResponse {
  nonce: string;
  message: string;
}

export interface WalletVerifyBody {
  address: string;
  signature: string; // no nonce field - the backend looks it up by address (wallet_auth.md 2.2)
}

// ---- files ----

export interface FileOut {
  id: string;
  name: string;
  owner: string;
  size: number;
  protection: ProtectionMode;
  verification: string; // "verified" - self-consistency only until the chain layer lands, see ADR 0005
  hash: string;
  ownership_tx: string | null; // always null until Sriganesh's ChainService is wired in
  content_type: string;
  current_version: number;
  approved_version: number | null;
  created_at: string;
  updated_at: string;
  my_access: PermissionLevel | null;
}

export interface VerifyResult {
  file_id: string;
  local_hash: string;
  chain_hash: string; // mirrors local_hash until the chain layer lands
  verified: boolean;
  timestamp: string;
}

export interface DashboardSummary {
  total_files: number;
  verified_files: number;
  pending_approvals: number;
  active_permissions: number;
  integrity_score: string; // e.g. "100%"
  blockchain_status: string; // e.g. "connected (fake chain - dev)"
}

// ---- versions ----

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

// ---- permissions ----

export interface PermissionOut {
  id: string;
  file_id: string;
  grantee: string;
  permission: PermissionLevel;
  status: PermissionStatus;
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
  signature?: string | null; // Pannaga's signing flow fills this in
}

// ---- approvals ----

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
  signature?: string | null; // Pannaga's signing flow fills this in
}

// ---- errors ----

/** Shape of the JSON body FastAPI's DomainError handler returns (main.py). */
export interface ApiErrorBody {
  detail: string;
  code?: string;
}
