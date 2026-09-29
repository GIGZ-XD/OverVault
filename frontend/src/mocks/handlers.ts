import { http, HttpResponse } from "msw";
import initialApprovals from "@/mocks/fixtures/approvals.json";
import initialAudit from "@/mocks/fixtures/audit.json";
import initialFiles from "@/mocks/fixtures/files.json";
import initialPermissions from "@/mocks/fixtures/permissions.json";
import initialUsers from "@/mocks/fixtures/users.json";
import initialVersions from "@/mocks/fixtures/versions.json";

/**
 * Mock auth mirrors the real nonce flow but deliberately accepts only the
 * mock adapter signature. Cryptographic verification belongs to the backend.
 */
const nonceStore = new Map<string, string>();
const mockSignature = "0xmocksig_pannaga_overvault_test";
const usersByAddress = Object.fromEntries(initialUsers.map((user) => [user.wallet.toLowerCase(), user]));

let filesState = [...initialFiles];
let approvalsState = [...initialApprovals];
let auditState = [...initialAudit];
let versionsState: Array<Record<string, any>> = [...initialVersions];
let permissionsState: Array<Record<string, any>> = [...initialPermissions];
let sequence = 1;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

function mockNonce(): string {
  return `mock-nonce-${sequence}-${"0".repeat(48)}`;
}

export const handlers = [
  http.get("*/api/health", () => HttpResponse.json({ status: "ok", timestamp: new Date().toISOString() })),

  http.post("*/api/auth/dev-login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const user = initialUsers.find((item) => item.name === body.email) ?? initialUsers[0];
    return HttpResponse.json({
      access_token: "mock-dev-jwt-token-xyz123",
      token_type: "bearer",
      user: { ...user, email: `${user.id}@example.test`, wallet_address: user.wallet },
    });
  }),

  http.post("*/api/auth/nonce", async ({ request }) => {
    const body = (await request.json()) as { address?: string };
    const address = (body.address ?? "").toLowerCase();
    if (!address) return HttpResponse.json({ detail: "address required" }, { status: 422 });
    const nonce = mockNonce();
    nonceStore.set(address, nonce);
    return HttpResponse.json({ nonce, message: `Sign in to OverVault.\n\nNonce: ${nonce}` });
  }),

  http.post("*/api/auth/wallet-login", async ({ request }) => {
    const body = (await request.json()) as { address?: string; signature?: string };
    const address = (body.address ?? "").toLowerCase();
    const signature = body.signature ?? "";
    if (!nonceStore.has(address)) {
      return HttpResponse.json({ detail: { code: "nonce_expired", message: "No valid nonce" } }, { status: 401 });
    }
    nonceStore.delete(address);
    if (signature !== mockSignature) {
      return HttpResponse.json({ detail: { code: "invalid_signature", message: "Signature mismatch" } }, { status: 401 });
    }
    const user = usersByAddress[address];
    if (!user) {
      return HttpResponse.json({ detail: { code: "address_not_found", message: "Address not registered" } }, { status: 403 });
    }
    return HttpResponse.json({
      access_token: `mock.jwt.${user.id}.${sequence}`,
      token_type: "bearer",
      user: { ...user, email: `${user.id}@example.test`, wallet_address: user.wallet },
    });
  }),

  http.get("*/api/dashboard/summary", () => HttpResponse.json({
    total_files: filesState.length,
    verified_files: filesState.filter((file) => file.verification === "verified").length,
    pending_approvals: approvalsState.filter((approval) => approval.status === "pending").length,
    active_permissions: permissionsState.filter((permission) => permission.status === "active").length,
    integrity_score: "100%",
    blockchain_status: "connected (fake chain - dev)",
  })),

  http.get("*/api/files", () => HttpResponse.json(filesState)),

  http.post("*/api/files", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string; size?: number; protection?: string };
    const file = {
      id: nextId("f"),
      name: body.name ?? "uploaded-document.pdf",
      owner: "u1",
      size: body.size ?? 124500,
      protection: body.protection ?? "none",
      verification: "verified",
      hash: "0x9f3a11c21e",
      ownership_tx: "0xtx1",
    };
    filesState = [file, ...filesState];
    versionsState = [...versionsState, {
      file_id: file.id,
      version: 1,
      author: file.owner,
      created_at: new Date().toISOString(),
      hash: file.hash,
      verification: "verified",
    }];
    auditState = [{
      id: nextId("e"),
      event_type: "ownership_register",
      file_id: file.id,
      actor: "0xaaa1",
      tx_hash: file.ownership_tx,
      verification: "verified",
      timestamp: Math.floor(Date.now() / 1000),
    }, ...auditState];
    return HttpResponse.json(file, { status: 201 });
  }),

  http.get("*/api/files/:id", ({ params }) => {
    const file = filesState.find((item) => item.id === params.id);
    return file ? HttpResponse.json(file) : new HttpResponse(null, { status: 404 });
  }),

  http.delete("*/api/files/:id", ({ params }) => {
    filesState = filesState.filter((file) => file.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/files/:id/download", ({ params }) => {
    const file = filesState.find((item) => item.id === params.id);
    return HttpResponse.json({ content: `[Encrypted Vault Content for ${file?.name ?? params.id}]`, hash: file?.hash ?? "0x9f3a11c21e", verified: true });
  }),

  http.post("*/api/files/:id/verify", ({ params }) => {
    const file = filesState.find((item) => item.id === params.id);
    return HttpResponse.json({ file_id: params.id, local_hash: file?.hash ?? "0x9f3a11c21e", chain_hash: file?.hash ?? "0x9f3a11c21e", verified: true, timestamp: new Date().toISOString() });
  }),

  http.put("*/api/files/:id/protection", async ({ params, request }) => {
    const body = (await request.json()) as { protection: string };
    filesState = filesState.map((file) => file.id === params.id ? { ...file, protection: body.protection } : file);
    return HttpResponse.json({ id: params.id, protection: body.protection });
  }),

  http.get("*/api/files/:id/versions", ({ params }) => HttpResponse.json(versionsState.filter((version) => version.file_id === params.id))),

  http.post("*/api/files/:id/versions", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as { comment?: string };
    const fileVersions = versionsState.filter((version) => version.file_id === params.id);
    const version = { id: nextId("v"), file_id: params.id as string, version_number: fileVersions.length + 1, sha256: "0x9f3a11c21e", size_bytes: 124500, author_id: "u1", comment: body.comment ?? "", rolled_back_from: null, created_at: new Date().toISOString() };
    versionsState = [...versionsState, version];
    return HttpResponse.json(version, { status: 201 });
  }),

  http.get("*/api/files/:id/permissions", ({ params }) => HttpResponse.json(permissionsState.filter((permission) => permission.file_id === params.id))),
  http.post("*/api/files/:id/permissions", async ({ params, request }) => {
    const body = (await request.json()) as { grantee?: string; permission?: string; expires_at?: string };
    const permission = { id: nextId("p"), file_id: params.id as string, grantee: body.grantee ?? "u2", permission: body.permission ?? "read", expires_at: body.expires_at ?? null, status: "active" };
    permissionsState = [...permissionsState, permission];
    return HttpResponse.json(permission, { status: 201 });
  }),
  http.delete("*/api/permissions/:id", ({ params }) => {
    permissionsState = permissionsState.filter((permission) => permission.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/approvals", () => HttpResponse.json(approvalsState)),
  http.post("*/api/approvals", async ({ request }) => {
    const body = (await request.json()) as { file_id?: string; comment?: string };
    const approval = { id: nextId("a"), file_id: body.file_id ?? "f1", version_number: 1, submitted_by: "u1", reviewer_id: null, status: "pending", comment: body.comment ?? "Requested update", request_comment: body.comment ?? "Requested update", decision_comment: "", created_at: new Date().toISOString(), decided_at: null };
    approvalsState = [approval, ...approvalsState];
    return HttpResponse.json(approval, { status: 201 });
  }),
  http.post("*/api/approvals/:id/decision", async ({ params, request }) => {
    const body = (await request.json()) as { decision?: "approved" | "rejected"; signature?: string | null };
    const status = body.decision ?? "approved";
    approvalsState = approvalsState.map((approval) => approval.id === params.id ? { ...approval, status, decided_at: new Date().toISOString(), decision_comment: "" } : approval);
    auditState = [{ id: nextId("e"), event_type: "approval_decision", file_id: "f1", actor: "0xaaa1", tx_hash: "0xtx1", verification: "verified", timestamp: Math.floor(Date.now() / 1000) }, ...auditState];
    return HttpResponse.json(approvalsState.find((approval) => approval.id === params.id) ?? { id: params.id, status });
  }),

  http.get("*/api/audit", () => HttpResponse.json(auditState)),
  http.get("*/api/users", () => HttpResponse.json(initialUsers)),
];
