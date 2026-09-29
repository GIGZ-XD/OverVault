import { http, HttpResponse } from "msw";
import initialFiles from "@/mocks/fixtures/files.json";
import initialApprovals from "@/mocks/fixtures/approvals.json";
import initialAudit from "@/mocks/fixtures/audit.json";
import initialPermissions from "@/mocks/fixtures/permissions.json";
import initialUsers from "@/mocks/fixtures/users.json";
import initialVersions from "@/mocks/fixtures/versions.json";
import initialNodes from "@/mocks/fixtures/nodes.json";

// In-memory mutable state for realistic interactive preview without backend
let filesState = [...initialFiles];
let approvalsState = [...initialApprovals];
let auditState = [...initialAudit];
let permissionsState = [...initialPermissions];
let usersState = [...initialUsers];
let versionsState = [...initialVersions];
let nodesState = [...initialNodes];
let replicationPolicyState = {
  replication_factor: 3,
  min_write_quorum: 2,
  auto_rebalance: true,
  heartbeat_interval_sec: 15,
  encryption_mode: "AES-256-GCM",
};

export const handlers = [
  // Health check
  http.get("*/health", () => {
    return HttpResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  }),

  // Auth Dev & Wallet endpoints
  http.post("*/auth/dev-login", () => {
    return HttpResponse.json({ access_token: "mock-dev-jwt-token-xyz123", token_type: "bearer" });
  }),
  http.post("*/auth/nonce", () => {
    return HttpResponse.json({ nonce: "overvault-nonce-987654321" });
  }),
  http.post("*/auth/wallet-login", () => {
    return HttpResponse.json({ access_token: "mock-wallet-jwt-token-abc789", token_type: "bearer" });
  }),

  // Dashboard summary
  http.get("*/dashboard/summary", () => {
    const verifiedCount = filesState.filter((f) => f.verification === "verified").length;
    const pendingApprovals = approvalsState.filter((a) => a.status === "pending").length;
    const activeGrants = permissionsState.filter((p) => p.status === "active").length;
    return HttpResponse.json({
      total_files: filesState.length,
      verified_files: verifiedCount,
      pending_approvals: pendingApprovals,
      active_permissions: activeGrants,
      integrity_score: "100%",
      blockchain_status: "connected (MST Testnet)",
    });
  }),

  // Files
  http.get("*/files", () => {
    return HttpResponse.json(filesState);
  }),

  http.post("*/files", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const newFile = {
      id: `f${Date.now()}`,
      name: body.name || "uploaded-document.pdf",
      owner: body.owner || "u1",
      size: body.size || 124500,
      protection: body.protection || "none",
      verification: "verified",
      hash: "0x" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      ownership_tx: "0xtx" + Math.floor(Math.random() * 10000),
    };
    filesState.unshift(newFile);

    // Add initial version
    versionsState.push({
      file_id: newFile.id,
      version: 1,
      author: newFile.owner,
      created_at: new Date().toISOString(),
      hash: newFile.hash,
      verification: "verified",
    });

    // Add audit log entry
    auditState.unshift({
      id: `e${Date.now()}`,
      event_type: "ownership_register",
      file_id: newFile.id,
      file_name: newFile.name,
      actor: "0xaaa1",
      actor_name: "Asha Rao",
      tx_hash: newFile.ownership_tx,
      verification: "verified",
      timestamp: Math.floor(Date.now() / 1000),
      detail: `Registered SHA-256 ownership digest for ${newFile.name}`,
    });

    return HttpResponse.json(newFile, { status: 201 });
  }),

  http.get("*/files/:id", ({ params }) => {
    const file = filesState.find((f) => f.id === params.id);
    if (!file) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(file);
  }),

  http.delete("*/files/:id", ({ params }) => {
    filesState = filesState.filter((f) => f.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/files/:id/download", ({ params }) => {
    const file = filesState.find((f) => f.id === params.id);
    return HttpResponse.json({
      content: `[Encrypted Vault Content for ${file?.name || params.id}]`,
      hash: file?.hash || "0x9f3a11c21e",
      verified: true,
    });
  }),

  http.post("*/files/:id/verify", ({ params }) => {
    const file = filesState.find((f) => f.id === params.id);
    return HttpResponse.json({
      file_id: params.id,
      local_hash: file?.hash || "0x9f3a11c21e",
      chain_hash: file?.hash || "0x9f3a11c21e",
      verified: true,
      timestamp: new Date().toISOString(),
    });
  }),

  http.put("*/files/:id/protection", async ({ params, request }) => {
    const body = (await request.json()) as { protection: string };
    const fileIndex = filesState.findIndex((f) => f.id === params.id);
    if (fileIndex !== -1) {
      filesState[fileIndex] = { ...filesState[fileIndex], protection: body.protection };
    }
    return HttpResponse.json({ id: params.id, protection: body.protection });
  }),

  // Versions
  http.get("*/files/:id/versions", ({ params }) => {
    const fileVersions = versionsState.filter((v) => v.file_id === params.id);
    return HttpResponse.json(fileVersions);
  }),

  http.post("*/files/:id/versions", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const existing = versionsState.filter((v) => v.file_id === params.id);
    const newVersion = {
      file_id: params.id as string,
      version: existing.length + 1,
      author: body.author || "u1",
      created_at: new Date().toISOString(),
      hash: "0x" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      verification: "verified",
    };
    versionsState.push(newVersion);
    return HttpResponse.json(newVersion, { status: 201 });
  }),

  http.post("*/files/:id/versions/:v/rollback", ({ params }) => {
    const targetVersion = versionsState.find(
      (v) => v.file_id === params.id && v.version === Number(params.v)
    );
    if (!targetVersion) return new HttpResponse(null, { status: 404 });
    
    // Update file active hash to match rolled back version
    const fileIndex = filesState.findIndex((f) => f.id === params.id);
    if (fileIndex !== -1) {
      filesState[fileIndex] = { ...filesState[fileIndex], hash: targetVersion.hash };
    }
    return HttpResponse.json({ status: "rolled_back", active_version: Number(params.v) });
  }),

  // Permissions
  http.get("*/files/:id/permissions", ({ params }) => {
    const filePermissions = permissionsState.filter((p) => p.file_id === params.id);
    return HttpResponse.json(filePermissions);
  }),

  http.post("*/files/:id/permissions", async ({ params, request }) => {
    const body = (await request.json()) as any;
    const newPerm = {
      id: `p${Date.now()}`,
      file_id: params.id as string,
      grantee: body.grantee || "u2",
      permission: body.permission || "read",
      expires_at: body.expires_at || "2026-12-31T00:00:00Z",
      status: "active",
    };
    permissionsState.push(newPerm);
    return HttpResponse.json(newPerm, { status: 201 });
  }),

  http.delete("*/permissions/:id", ({ params }) => {
    permissionsState = permissionsState.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Approvals
  http.get("*/approvals", () => {
    return HttpResponse.json(approvalsState);
  }),

  http.post("*/approvals", async ({ request }) => {
    const body = (await request.json()) as any;
    const newApproval = {
      id: `a${Date.now()}`,
      file_id: body.file_id || "f1",
      submitted_by: body.submitted_by || "u1",
      status: "pending",
      comment: body.comment || "Requested update",
    };
    approvalsState.unshift(newApproval);
    return HttpResponse.json(newApproval, { status: 201 });
  }),

  http.post("*/approvals/:id/decision", async ({ params, request }) => {
    const body = (await request.json()) as { decision: "approved" | "rejected" };
    const approvalIndex = approvalsState.findIndex((a) => a.id === params.id);
    if (approvalIndex !== -1) {
      approvalsState[approvalIndex] = {
        ...approvalsState[approvalIndex],
        status: body.decision,
      };
    }
    return HttpResponse.json({ id: params.id, status: body.decision });
  }),

  // Audit
  http.get("*/audit", () => {
    return HttpResponse.json(auditState);
  }),

  // Users
  http.get("*/users", () => {
    return HttpResponse.json(usersState);
  }),

  // Storage Nodes
  http.get("*/nodes", () => {
    return HttpResponse.json(nodesState);
  }),

  http.post("*/nodes/token", () => {
    const token = `mst-node-sec-${Math.random().toString(36).substring(2, 15)}`;
    return HttpResponse.json({
      token,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      install_command: `curl -sSL https://overvault.mst/install-agent.sh | sh -s -- --token=${token} --cluster=mst-corp-vault`,
    });
  }),

  http.post("*/nodes/register", async ({ request }) => {
    const body = (await request.json()) as any;
    const newNode = {
      id: `node-${(body.name || "custom-node").toLowerCase().replace(/\s+/g, "-").slice(0, 20)}-${Math.random().toString(36).substring(2, 6)}`,
      name: body.name || "New Storage Node",
      hostname: body.hostname || "storage-node.internal",
      ip_address: body.ip_address || "192.168.1.50",
      region: body.region || "Local Edge",
      allocated_storage_gb: Number(body.allocated_storage_gb) || 500,
      used_storage_gb: 0.0,
      status: "online",
      health_score: 100,
      latency_ms: Math.floor(Math.random() * 20) + 10,
      uptime_percentage: 100.0,
      is_bootstrap: false,
      agent_version: "v1.2.0",
      stored_chunks_count: 0,
      last_heartbeat: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    nodesState.push(newNode);

    // Record audit event
    auditState.unshift({
      id: `e${Date.now()}`,
      event_type: "node_register",
      file_id: newNode.id,
      file_name: newNode.name,
      actor: "0xccc3",
      actor_name: "Meera Iyer (admin)",
      tx_hash: "0x" + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      verification: "verified",
      timestamp: Math.floor(Date.now() / 1000),
      detail: `Registered new storage node [${newNode.name}] with ${newNode.allocated_storage_gb}GB allocation`,
    });

    return HttpResponse.json(newNode, { status: 201 });
  }),

  http.put("*/nodes/:id/allocation", async ({ params, request }) => {
    const body = (await request.json()) as { allocated_storage_gb: number };
    const nodeIndex = nodesState.findIndex((n) => n.id === params.id);
    if (nodeIndex !== -1) {
      nodesState[nodeIndex] = {
        ...nodesState[nodeIndex],
        allocated_storage_gb: body.allocated_storage_gb,
      };
      return HttpResponse.json(nodesState[nodeIndex]);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete("*/nodes/:id/decommission", ({ params }) => {
    const target = nodesState.find((n) => n.id === params.id);
    if (!target) return new HttpResponse(null, { status: 404 });
    const evacuatedChunks = target.stored_chunks_count || 120;
    nodesState = nodesState.filter((n) => n.id !== params.id);

    // Record audit event
    auditState.unshift({
      id: `e${Date.now()}`,
      event_type: "node_decommission",
      file_id: target.id,
      file_name: target.name,
      actor: "0xccc3",
      actor_name: "Meera Iyer (admin)",
      tx_hash: "0x" + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      verification: "verified",
      timestamp: Math.floor(Date.now() / 1000),
      detail: `Evacuated ${evacuatedChunks} chunks & safely removed storage node [${target.name}]`,
    });

    return HttpResponse.json({
      status: "decommissioned",
      node_id: params.id,
      evacuated_chunks: evacuatedChunks,
      message: `Evacuated ${evacuatedChunks} encrypted chunks and safely removed node.`,
    });
  }),

  http.get("*/nodes/replication-policy", () => {
    return HttpResponse.json(replicationPolicyState);
  }),

  http.put("*/nodes/replication-policy", async ({ request }) => {
    const body = (await request.json()) as any;
    replicationPolicyState = { ...replicationPolicyState, ...body };
    return HttpResponse.json(replicationPolicyState);
  }),
];
