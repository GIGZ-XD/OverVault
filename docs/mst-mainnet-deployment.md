# MST Mainnet Deployment & Migration Guide

## Executive Overview
This guide provides complete end-to-end instructions for deploying OverVault smart contracts and backend infrastructure to **MST EVM Mainnet**.

---

## 1. Network Specifications

| Parameter | MST Testnet | MST Mainnet (Target) |
| :--- | :--- | :--- |
| **Network Name** | MST EVM Testnet | MST EVM Mainnet |
| **Chain ID** | `1337` (or Testnet ID) | `1338` (or MST Mainnet ID) |
| **RPC Endpoint** | `https://rpc.testnet.mst.xyz` | `https://rpc.mainnet.mst.xyz` |
| **Block Explorer** | `https://scan.testnet.mst.xyz` | `https://scan.mst.xyz` |
| **Native Gas Token** | MST | MST |
| **Block Time** | ~2.0s | ~2.0s |
| **Finality Confirmations** | 1–5 blocks | 12 blocks |

---

## 2. Pre-Deployment Checklist

1. [ ] **Mainnet Deployer Wallet Funded:** Ensure the deployer address holds sufficient native MST for contract deployments (~0.05 MST).
2. [ ] **Relayer / Worker Wallet Funded:** Ensure dedicated backend outbox worker address is funded with gas funds (~0.1 MST).
3. [ ] **Private Keys Secured:** Keys stored in production secret store (AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager), NEVER in source code or unencrypted files.
4. [ ] **Compiler Configuration Validated:** Hardhat Solidity optimizer enabled (runs: 200), EVM target version locked.
5. [ ] **Automated Test Suite Verified:** Run `npx hardhat test` and `pytest -rs` with 100% pass rate.

---

## 3. Smart Contract Deployment Steps

### Step 3.1: Configure Environment for Mainnet Deployment
Export the required deployment variables or inject them into your secure CI/CD pipeline:

```bash
export MST_RPC_URL="https://rpc.mainnet.mst.xyz"
export MST_CHAIN_ID="1338"
export MST_PRIVATE_KEY="0x<DEPLOYER_PRIVATE_KEY>"
```

### Step 3.2: Execute Deployment Script
From the `contracts/` directory:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network mst_mainnet
```

*Output Example:*
```text
Deploying contracts with account: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
Audit deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Integrity deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Ownership deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Permission deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
Deployment artifacts and addresses recorded in deployment-mainnet.json
```

---

## 4. Contract Verification on MSTScan

Verify each deployed contract on MSTScan via Hardhat or MSTScan Web UI:

```bash
npx hardhat verify --network mst_mainnet 0x5FbDB2315678afecb367f032d93F642f64180aa3
npx hardhat verify --network mst_mainnet 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
npx hardhat verify --network mst_mainnet 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
npx hardhat verify --network mst_mainnet 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

---

## 5. Backend Configuration Migration

Update the backend production environment variables:

```env
# Chain Integration
CHAIN_MODE=real
MST_RPC_URL=https://rpc.mainnet.mst.xyz
MST_CHAIN_ID=1338
MST_PRIVATE_KEY=0x<RELAYER_PRIVATE_KEY>

# Contract Addresses
CONTRACT_AUDIT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CONTRACT_INTEGRITY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
CONTRACT_OWNERSHIP_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
CONTRACT_PERMISSION_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# Outbox Worker Tuning
OUTBOX_BATCH_SIZE=100
OUTBOX_POLL_INTERVAL=5.0
TX_TIMEOUT_SECONDS=120
```

---

## 6. Post-Deployment Verification & Smoke Testing

1. **Check Node Connection:**
   Query health endpoint or run backend integration smoke tests against mainnet RPC.
2. **Execute Initial Audit Log:**
   Submit a test audit log via outbox and verify confirmation in the PostgreSQL outbox and on MSTScan.
3. **Validate Idempotency & Monitoring:**
   Check `/transaction/{tx_hash}` returns `status: "confirmed"`, contract name, and event name.

---

## 7. Incident Recovery & Rollback

- **RPC Failure:** Switch `MST_RPC_URL` to fallback secondary mainnet RPC endpoint; outbox automatically pauses and resumes with exponential backoff.
- **Gas Spikes:** Increase gas limits or adjust priority fees in `RealChainService._send_tx`.
- **Key Compromise:** Immediately rotate `MST_PRIVATE_KEY`, transfer contract ownership to newly secured multi-sig wallet, and restart backend instances.
