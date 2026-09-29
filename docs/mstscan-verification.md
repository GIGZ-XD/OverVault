# OverVault — MSTScan Verification Guide

**Author:** Sriganesh (Blockchain & Audit Engineer)  
**Network:** MST EVM Testnet (`https://rpc.testnet.mst.xyz`, Chain ID: `1337`)  
**Explorer:** MSTScan Explorer (`https://scan.testnet.mst.xyz`)  

---

## 1. Overview

OverVault anchors document lifecycle events, ownership registrations, content hash commitments, and permission grants directly onto the **MST EVM Blockchain**. 

Every on-chain write produces an immutable transaction hash (`tx_hash`). These transactions can be verified independently on **MSTScan** (or any EVM-compatible block explorer) without relying on OverVault's backend.

---

## 2. End-to-End Verification Pipeline Flow

```
User / API Action (e.g. Upload, Commit Hash, Grant Permission)
                          │
                          ▼
            Audit Event Creation (AuditEvent)
                          │
                          ▼
           PostgreSQL Outbox Table (AuditOutbox)
       [status: pending -> processing -> submitted -> confirmed]
                          │
                          ▼
             Background Worker (outbox_worker)
                          │
                          ▼
           RealChainService (Web3.py EVM Adapter)
                          │
                          ▼
                MST EVM Blockchain
         ├── Audit.sol (logAudit)
         ├── Integrity.sol (commitHash)
         ├── Ownership.sol (registerOwnership)
         └── Permission.sol (grantPermission)
                          │
                          ▼
            MSTScan Block Explorer & Verification APIs
```

---

## 3. How to Retrieve Transaction Hashes

### Option A: Using OverVault Verification APIs
You can retrieve the `tx_hash` for any file or event using the audit API endpoints:

1. **Get Chronological Audit Trail:**
   ```bash
   curl -X GET http://localhost:8000/api/v1/audit/file-12345
   ```
   **Response:**
   ```json
   [
     {
       "event_type": "FILE_UPLOADED",
       "reference_id": "file-12345",
       "actor": "0x4F1d8e1234567890abcdef1234567890abcdef12",
       "status": "confirmed",
       "tx_hash": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
       "created_at": "2026-09-29T06:00:00Z"
     }
   ]
   ```

2. **Get Verification Summary:**
   ```bash
   curl -X GET http://localhost:8000/api/v1/audit/file-12345/verify
   ```
   **Response:**
   ```json
   {
     "file_id": "file-12345",
     "integrity": "verified",
     "ownership": "verified",
     "audit_events": 3,
     "latest_transaction": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b"
   }
   ```

3. **Get Rich Transaction Details:**
   ```bash
   curl -X GET http://localhost:8000/api/v1/transaction/0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
   ```
   **Response:**
   ```json
   {
     "tx_hash": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
     "status": "confirmed",
     "block_number": 104523,
     "gas_used": 48210,
     "confirmations": 14,
     "chain_id": 1337,
     "timestamp": 1727560800
   }
   ```

---

## 4. How to Verify Transactions on MSTScan

Navigate to MSTScan at `https://scan.testnet.mst.xyz` and paste the transaction hash into the search bar.

### Verification Data Points:

| Field | Description | Expected Value / Format |
|---|---|---|
| **Transaction Hash** | Unique 32-byte hex string | `0x[a-f0-9]{64}` |
| **Status** | Execution result on-chain | `Success` / `0x1` (confirmed) |
| **Block Number** | Height of the block containing the tx | e.g. `104523` (> 0) |
| **Gas Used / Gas Limit** | Gas units consumed by EVM execution | ~21,000 - 85,000 gas |
| **Confirmations** | Current block height minus tx block height | >= 1 |
| **Network / Chain ID** | Network identifier | `1337` (MST EVM Testnet) |
| **To (Contract Address)** | Deployed OverVault smart contract address | Verified contract address |
| **From (Signer)** | OverVault signing wallet address | Configured backend signer address |
| **Logs / Emitted Events** | Decoded contract event logs | See contract event specifications below |

---

## 5. Smart Contract Verification & Event Decoders

OverVault deploys four modular smart contracts on the MST EVM:

### 1. `Audit.sol` — Generic Audit Trail Logger
- **Function:** `logAudit(string eventType, string referenceId, string actor)`
- **Emitted Event:**
  ```solidity
  event AuditLogged(
      uint256 indexed entryId,
      string eventType,
      string referenceId,
      string actor,
      uint256 timestamp
  );
  ```
- **MSTScan Verification:**
  Under the **Logs** tab on MSTScan, verify the `AuditLogged` event containing the exact `eventType` (e.g. `FILE_UPLOADED`, `FILE_DELETED`), `referenceId` (file UUID), and `actor`.

### 2. `Integrity.sol` — Document Hash Anchoring
- **Function:** `commitHash(string fileId, uint256 version, string contentHash)`
- **Emitted Event:**
  ```solidity
  event HashCommitted(
      string indexed fileId,
      uint256 indexed version,
      string contentHash,
      uint256 timestamp
  );
  ```
- **MSTScan Verification:**
  Inspect `HashCommitted` log to verify the immutable SHA-256 content hash committed for the specific file version. Read verification can also be tested via `verifyHash(fileId, version, contentHash)` on MSTScan's **Read Contract** tab.

### 3. `Ownership.sol` — File Ownership Registry
- **Function:** `registerOwnership(string fileId, address owner)`
- **Emitted Event:**
  ```solidity
  event OwnershipRegistered(
      string indexed fileId,
      address indexed owner,
      uint256 timestamp
  );
  ```
- **MSTScan Verification:**
  Inspect `OwnershipRegistered` log to verify that the file's owner address matches the intended owner wallet.

### 4. `Permission.sol` — Role & Access Management
- **Function:** `grantPermission(string fileId, address grantee, string action, uint256 expiry)`
- **Emitted Event:**
  ```solidity
  event PermissionGranted(
      string indexed fileId,
      address indexed grantee,
      string action,
      uint256 expiry,
      uint256 timestamp
  );
  ```
- **MSTScan Verification:**
  Inspect `PermissionGranted` log on MSTScan confirming the granted action (e.g. `"read"`, `"write"`) and expiry timestamp.

---

## 6. Verification Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| **Transaction not found (404)** | Transaction is pending in outbox worker or mempool | Check `GET /audit/{file_id}` status; wait for worker cycle. |
| **Transaction Status = Failed (Reverted)** | Execution reverted by EVM (e.g. unauthorized caller or duplicate key) | Check transaction error log; verify caller permissions. |
| **Hash Mismatch** | Local file modified after hashing | Recalculate SHA-256 of file buffer and compare against `content_hash` in `HashCommitted` event. |
