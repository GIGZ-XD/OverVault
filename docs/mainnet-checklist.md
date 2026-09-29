# OverVault — MST Mainnet Readiness Checklist

**Engineer:** Sriganesh (Blockchain & Audit Engineer)  
**Target Environment:** MST Blockchain Mainnet  
**Target Chain ID:** `1337` / MST Mainnet ID  

---

## 1. Overview

This checklist defines the operational, security, and smart contract verification gates required before promoting OverVault's blockchain integration layer from the **MST Testnet** to **Production Mainnet**.

---

## 2. Smart Contracts Readiness

- [x] **Contract Unit & Integration Tests Passing:**
  - All 61 Hardhat Solidity tests passing (`npx hardhat test`).
  - Full coverage across `Audit.sol`, `Integrity.sol`, `Ownership.sol`, and `Permission.sol`.
- [x] **Deployment Scripts Validated:**
  - Deterministic deployment script verified (`contracts/scripts/deploy.js`).
  - Idempotent address tracking via `contracts/deployments.json`.
- [x] **ABI Artifact Generation:**
  - Hardhat artifact generation automated (`npx hardhat compile`).
  - Artifact JSONs loaded directly via `backend/app/chain/real.py` without manual copy/paste risk.
- [x] **Contract Addresses Recorded:**
  - Mainnet addresses parameterized via environment variables (`CONTRACT_ADDRESS_AUDIT`, `CONTRACT_ADDRESS_INTEGRITY`, `CONTRACT_ADDRESS_OWNERSHIP`, `CONTRACT_ADDRESS_PERMISSION`).
- [x] **Event Signatures & Decoders Verified:**
  - `AuditLogged(uint256,string,string,string,uint256)`
  - `HashCommitted(string,uint256,string,uint256)`
  - `OwnershipRegistered(string,address,uint256)`
  - `PermissionGranted(string,address,string,uint256,uint256)`
- [x] **Access Control & Permissions Reviewed:**
  - Ownership transfer rules restricted to file owners or authorized administrators.
  - Re-entrancy guards and parameter length validation applied.

---

## 3. MST Blockchain Connection & RPC Layer

- [x] **Production RPC Configuration:**
  - Primary and fallback JSON-RPC endpoints configured via `EVM_RPC_URL` / `MST_RPC_URL`.
  - HTTP connection health checks with timeout budgets (120s max receipt wait).
- [x] **Chain ID Verification:**
  - Network validation against target Chain ID before transaction broadcast to prevent cross-network replay.
- [x] **Wallet & Signer Configuration:**
  - Single designated backend signer wallet with isolated gas reserves.
  - Checksum address validation enforced on all owner/grantee inputs (`Web3.to_checksum_address`).
- [x] **Nonce Management:**
  - Dynamic nonce retrieval (`eth_getTransactionCount`) preventing nonce collision and stuck transactions.
- [x] **Gas Price & Gas Limit Estimation:**
  - Real-time `eth_estimateGas` calculation plus a safety buffer (`+50,000` gas units).
  - Dynamic gas price fetching via `eth_gasPrice`.

---

## 4. Security & Secret Management

- [x] **No Hardcoded Secrets:**
  - Zero private keys, seed phrases, or sensitive credentials committed to git history.
  - Secret scanning validated across repository.
- [x] **Environment Variable Validation:**
  - Fast-fail validation during `RealChainService` initialization (`_require_env`) with informative error messaging.
- [x] **Local Transaction Signing:**
  - Raw transactions built and signed locally using `eth_account.sign_transaction`; private keys are never transmitted over RPC.
- [x] **Contract Permissions & Reentrancy:**
  - Solidity state mutations follow the Checks-Effects-Interactions pattern.

---

## 5. Audit Pipeline & Worker Resiliency

- [x] **Transactional PostgreSQL Outbox:**
  - All audit events are atomically committed with application database writes before blockchain dispatch.
- [x] **Exponential Retry Backoff:**
  - Exponential delay schedule active (`5s`, `30s`, `5m`, `30m`, `1h`) preventing RPC flood during network outages.
- [x] **Dead-Letter Queue & Permanent Failure Isolation:**
  - Unrecoverable payloads or events exceeding `MAX_RETRIES` (5) are isolated to `dead_letter` state with full error diagnostics (`last_error`).
- [x] **Worker Crash & Restart Recovery:**
  - Outbox worker restarts cleanly pick up orphaned `processing` or `retry` rows without event loss or duplication.
- [x] **On-Chain Transaction Verification:**
  - `chain.verify_transaction(tx_hash)` validates receipt status (`status == 1`) before marking events as `confirmed`.

---

## 6. Pre-Launch Deployment Runbook

1. **Fund Mainnet Signer Wallet:** Ensure sufficient MST native tokens for contract deployment and initial transaction gas.
2. **Deploy Smart Contracts:**
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network mst_mainnet
   ```
3. **Configure Backend Environment Variables:**
   ```env
   CHAIN_MODE=real
   MST_RPC_URL=https://rpc.mst.xyz
   MST_CHAIN_ID=1337
   MST_PRIVATE_KEY=<SECURE_MAINNET_SIGNER_KEY>
   CONTRACT_ADDRESS_AUDIT=0x...
   CONTRACT_ADDRESS_INTEGRITY=0x...
   CONTRACT_ADDRESS_OWNERSHIP=0x...
   CONTRACT_ADDRESS_PERMISSION=0x...
   ```
4. **Run Smoke Tests & Health Check:**
   ```bash
   pytest -m mst_connection -rs
   curl -X GET http://localhost:8000/api/v1/health
   ```
5. **Start Outbox Background Worker:**
   ```bash
   python -m app.workers.outbox_worker
   ```
