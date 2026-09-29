# OverVault — Demo Transaction Walkthrough Guide

**Author:** Sriganesh (Blockchain & Audit Engineer)  
**Target Environment:** MST EVM Testnet (`https://rpc.testnet.mst.xyz`, Chain ID: `1337`)  
**Demo Status:** Ready for Live Presentation  

---

## 1. Overview

This walkthrough guides developers, auditors, and stakeholders through three live demonstration flows showcasing how OverVault creates, asynchronously anchors, and cryptographically verifies document transactions on the **MST Blockchain**.

---

## 2. Demo Flow 1: File Upload & Cryptographic Hash Anchoring

### Scenario
A user uploads an enterprise contract document (`Master_Services_Agreement_2026.pdf`). The system computes its SHA-256 digest, stores the event in the PostgreSQL outbox, and the outbox worker commits the integrity hash to `Integrity.sol` on the MST EVM blockchain.

### Step 1: Upload File & Record Audit Event
```bash
curl -X POST http://localhost:8000/api/v1/audit/record \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "FILE_UPLOADED",
    "reference_id": "file-msa-2026-001",
    "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
    "payload": {
      "file_name": "Master_Services_Agreement_2026.pdf",
      "version": 1,
      "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size_bytes": 2048576
    }
  }'
```

**Response (Immediate - HTTP 201):**
```json
{
  "id": "e4b2c1a0-8f3d-4c2b-9e1a-5f6d7c8b9a0e",
  "event_type": "FILE_UPLOADED",
  "reference_id": "file-msa-2026-001",
  "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
  "status": "pending",
  "tx_hash": null,
  "created_at": "2026-09-29T06:20:00Z"
}
```

### Step 2: Worker Processing & MST Blockchain Broadcast
The outbox background worker queries `AuditOutbox` for `status="pending"`, routes the event to `RealChainService.commit_hash(...)`, signs the transaction locally, broadcasts to the MST EVM node, and waits for block confirmation.

### Step 3: Verification on Verification API & MSTScan
```bash
curl -X GET http://localhost:8000/api/v1/audit/file-msa-2026-001/verify
```

**Verification Output:**
```json
{
  "file_id": "file-msa-2026-001",
  "integrity": "verified",
  "ownership": "verified",
  "audit_events": 1,
  "latest_transaction": "0x98f7e6d5c4b3a2109876543210abcdef0123456789abcdef0123456789abcdef"
}
```

---

## 3. Demo Flow 2: File Ownership Registration

### Scenario
An administrator or document author registers immutable legal ownership of a critical blueprint file to an Ethereum address on `Ownership.sol`.

### Step 1: Record Ownership Registration Event
```bash
curl -X POST http://localhost:8000/api/v1/audit/record \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "OWNERSHIP_REGISTERED",
    "reference_id": "file-blueprint-patent-99",
    "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
    "payload": {
      "file_id": "file-blueprint-patent-99",
      "owner_address": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
      "content_hash": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    }
  }'
```

### Step 2: Query Detailed Transaction Confirmation
```bash
curl -X GET http://localhost:8000/api/v1/transaction/0x98f7e6d5c4b3a2109876543210abcdef0123456789abcdef0123456789abcdef
```

**Response:**
```json
{
  "tx_hash": "0x98f7e6d5c4b3a2109876543210abcdef0123456789abcdef0123456789abcdef",
  "status": "confirmed",
  "block_number": 104820,
  "gas_used": 54120,
  "confirmations": 18,
  "chain_id": 1337,
  "timestamp": 1727561400
}
```

---

## 4. Demo Flow 3: Permission Grant & Access Control Verification

### Scenario
The owner grants time-bound `"read"` permissions to an external compliance auditor (`0xAuditorWallet`).

### Step 1: Record Permission Grant Event
```bash
curl -X POST http://localhost:8000/api/v1/audit/record \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "PERMISSION_GRANTED",
    "reference_id": "file-financial-audit-2026",
    "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
    "payload": {
      "file_id": "file-financial-audit-2026",
      "grantee": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "action": "read",
      "expiry": 1759104000
    }
  }'
```

### Step 2: Retrieve Full Audit Trail
```bash
curl -X GET http://localhost:8000/api/v1/audit/file-financial-audit-2026
```

**Response:**
```json
[
  {
    "event_type": "FILE_UPLOADED",
    "reference_id": "file-financial-audit-2026",
    "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
    "status": "confirmed",
    "tx_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "created_at": "2026-09-29T06:00:00Z"
  },
  {
    "event_type": "PERMISSION_GRANTED",
    "reference_id": "file-financial-audit-2026",
    "actor": "0x4F1d8e6E0b1A6e58913b4C4f981B205a2e51981B",
    "status": "confirmed",
    "tx_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
    "created_at": "2026-09-29T06:22:00Z"
  }
]
```

---

## 5. Live Presentation Summary Table

| Step | Action | Endpoint | Expected Output |
|---|---|---|---|
| **1** | Record Event | `POST /api/v1/audit/record` | Instant 201 Created (`status: pending`) |
| **2** | Background Worker | Async background cycle | Signs & anchors tx to MST EVM |
| **3** | Verify Integrity | `GET /api/v1/audit/{file_id}/verify` | `integrity: verified`, `ownership: verified` |
| **4** | Inspect Tx | `GET /api/v1/transaction/{tx_hash}` | Block number, gas used, confirmations |
| **5** | MSTScan Explorer | `https://scan.testnet.mst.xyz` | Decoded event logs matching OverVault records |
