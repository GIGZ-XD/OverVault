# OverVault Hackathon Demo Script

## Overview
This script walks through the end-to-end demo flow of OverVault: private encrypted enterprise storage with public SHA-256 integrity proofs on the MST Blockchain.

---

### Scene 1: Wallet Authentication via BridgeKey
1. **Navigate to OverVault**: Open `http://localhost:3000/login`
2. **Click "Connect BridgeKey Wallet"**:
   - The BridgeKey extension prompts for connection to the MST Testnet (Chain ID `91562037`).
   - Nonce request is dispatched: `POST /api/auth/nonce`.
   - BridgeKey prompts for EIP-191 personal signature of `"Sign in to OverVault.\n\nNonce: <nonce>"`.
   - Backend verifies signature against recovered address: `POST /api/auth/wallet-login`.
   - Token is stored in `localStorage["overvault.token"]`.
   - Automatic redirect to `/dashboard`.
3. **Show Dashboard**:
   - Display summary cards: Total files, Pending approvals, Active permissions, Integrity score.
   - Show the current wallet address in the top bar.

---

### Scene 2: Upload File & Cryptographic Commitment
1. **Click "Upload Document"**:
   - Select a local confidential file (e.g. `Q3-Financial-Report.pdf`).
   - Set protection mode to `tamper-proof`.
2. **What Happens Behind the Scenes**:
   - SHA-256 hash is computed locally: `e.g. 0x9f3a11c21e...`
   - File is encrypted and stored in the private vault (`storage_dir`).
   - File metadata and Version 1 are registered in SQLite/PostgreSQL.
   - An `AuditOutbox` event (`file.created`) is enqueued in the same database transaction.
   - Raw file content is **never** sent to the blockchain.
3. **View Document in Vault Table**:
   - Hash chip displays verified status.
   - "Integrity health" widget reflects the new file hash.

---

### Scene 3: Access Control & Versioning
1. **Open File Drawer**:
   - Click on the uploaded file in the table.
   - View metadata: Owner, Size, Protection mode, Hash, Creation timestamp.
2. **Grant Permission**:
   - Grant `read` access to employee wallet (`0xbbb2...`).
   - Audit event `permission.granted` is recorded in outbox.
3. **Upload Version 2**:
   - Upload modified version of the document.
   - Version 2 is hashed, stored, and linked.
   - Audit event `version.created` is recorded.

---

### Scene 4: Manager Approval Flow
1. **Submit for Approval**:
   - Request approval for the new version.
2. **Manager Review**:
   - Navigate to `/approvals`.
   - Review pending approval request with comments.
   - Click "Approve with BridgeKey".
   - BridgeKey wallet signs the approval decision.
   - Approval status updates to `approved`.
   - Audit event `approval.decision` recorded.

---

### Scene 5: Blockchain Integrity & Audit Trail
1. **Navigate to `/audit`**:
   - Show the full workspace audit trail.
   - Filter by event type (`File Created`, `Permission Granted`, `Approval Decision`).
   - Filter by actor wallet address.
   - Show that every critical action has an immutable record.
2. **Inspect Chain Proof**:
   - Click on a transaction hash link to view the commitment on MSTScan (`https://testnet.mstscan.com`).
   - Point out that only the digest (content hash) and reference ID are on-chain — zero private file content.
   - Real on-chain verified proofs on MST Testnet:
     - **Audit Event**: [`0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b`](https://testnet.mstscan.com/tx/0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b) on `Audit.sol` (`0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb`)
     - **Hash Commitment**: [`0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722`](https://testnet.mstscan.com/tx/0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722) on `Integrity.sol` (`0x5e724C47DCEccC41902f2D129091faf6D1D833AB`)
     - **Ownership Genesis**: [`0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5`](https://testnet.mstscan.com/tx/0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5) on `Ownership.sol` (`0x53017dd1A227a7Fcf7665C59B7E3360995dCB148`)

---

### Fallback / Mock Mode for Offline Presentation
If live MST Testnet RPC is unavailable during presentation:
- Set `NEXT_PUBLIC_WALLET_MODE=mock`
- Set `NEXT_PUBLIC_API_MODE=mock`
- Run demo completely locally using the deterministic mock adapter and simulated chain responses.
