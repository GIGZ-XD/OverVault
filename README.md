# OverVault

> **Blockchain-Audited Enterprise Storage and Document Management on MST Blockchain**

OverVault is a high-assurance document vault combining private encrypted storage with immutable public cryptographic proofs on **MST Blockchain** (MST Testnet) and decentralized identity authentication via **BridgeKey Wallet**.

---

## Key Security & Privacy Guarantee

> [!IMPORTANT]
> **Private file bytes NEVER cross the blockchain boundary.**
> Raw files are encrypted and retained strictly in private storage. The blockchain receives **only** cryptographic SHA-256 digests, file IDs, version integers, and actor wallet addresses.

```
+-----------------------------------------------------------------------------------------+
|                                    PRIVATE BOUNDARY                                     |
|                                                                                         |
|  [Browser UI]  <-- EIP-191 Sign -->  [BridgeKey Wallet]                                |
|        |                                                                                |
|        | REST API (Bearer JWT)                                                          |
|        v                                                                                |
|  [FastAPI Backend]                                                                      |
|        |                                                                                |
|        +---> [Encrypted Vault Storage] (Raw bytes AES/local disk)                      |
|        +---> [Database / SQL State]   (Metadata, Versions, RBAC, Approvals)             |
|        +---> [Audit Outbox Table]      (Transactional queue of events)                  |
+--------------------------------------------|--------------------------------------------+
                                             |  Async Worker (Hashes & Metadata ONLY)
+--------------------------------------------v--------------------------------------------+
|                                  PUBLIC BLOCKCHAIN                                      |
|                                                                                         |
|  [Web3 / Outbox Worker]                                                                 |
|        |                                                                                |
|        v  RPC: https://testnetrpc.mstblockchain.com (Chain ID: 91562037)               |
|  [MST Testnet Smart Contracts]                                                          |
|        +-- Audit.sol       (`0x9868...1Fdb`) -> Immutable event logs                   |
|        +-- Integrity.sol   (`0x5e72...33AB`) -> SHA-256 document hash anchors          |
|        +-- Ownership.sol   (`0x5301...B148`) -> Asset provenance & genesis anchors     |
|        +-- Permission.sol  (`0x6BC2...2b1E`) -> Cryptographic ACL verification         |
|                                                                                         |
|  [MSTScan Explorer] -> https://testnet.mstscan.com/tx/<txHash>                          |
+-----------------------------------------------------------------------------------------+
```

---

## Live MST Testnet Verification

All four smart contracts are compiled with Solidity `0.8.20` and deployed on the live MST Testnet.

### Network Parameters
- **Network Name**: MST EVM Testnet
- **RPC URL**: `https://testnetrpc.mstblockchain.com`
- **Chain ID**: `91562037` (`0x5752035`)
- **Currency Symbol**: MST ($tMSTC)
- **Block Explorer**: [https://testnet.mstscan.com](https://testnet.mstscan.com)
- **Deployer Wallet**: [`0x8D980974EFc134749E397178359e9356052F5409`](https://testnet.mstscan.com/address/0x8D980974EFc134749E397178359e9356052F5409)

### Confirmed Contract Addresses
| Contract | Address | Deployment Tx | MSTScan |
|---|---|---|---|
| **Audit.sol** | `0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb` | `0x31270b...` | [Audit on MSTScan](https://testnet.mstscan.com/address/0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb) |
| **Integrity.sol** | `0x5e724C47DCEccC41902f2D129091faf6D1D833AB` | `0x4af02a...` | [Integrity on MSTScan](https://testnet.mstscan.com/address/0x5e724C47DCEccC41902f2D129091faf6D1D833AB) |
| **Ownership.sol** | `0x53017dd1A227a7Fcf7665C59B7E3360995dCB148` | `0x75bdf0...` | [Ownership on MSTScan](https://testnet.mstscan.com/address/0x53017dd1A227a7Fcf7665C59B7E3360995dCB148) |
| **Permission.sol** | `0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E` | `0x89aac4...` | [Permission on MSTScan](https://testnet.mstscan.com/address/0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E) |

### Live Mined Transaction Proofs
1. **Audit Event (`Audit.logAudit`)**:
   - Tx: [`0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b`](https://testnet.mstscan.com/tx/0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b)
   - Block: `5795336` | Status: `Success (0x1)` | Event: `AuditLogged`
2. **Hash Commitment (`Integrity.commitHash`)**:
   - Tx: [`0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722`](https://testnet.mstscan.com/tx/0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722)
   - Block: `5795337` | Status: `Success (0x1)` | Event: `HashCommitted`
3. **Ownership Anchor (`Ownership.registerOwnership`)**:
   - Tx: [`0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5`](https://testnet.mstscan.com/tx/0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5)
   - Block: `5795340` | Status: `Success (0x1)`

---

## Features & End-to-End Flow

1. **BridgeKey Wallet Login**: Nonce-based cryptographic challenge with EIP-191 `personal_sign` signature recovery and JWT session issuance.
2. **Encrypted Storage & Versioning**: SHA-256 checksum calculation, content-addressed vault storage, and multi-version tracking.
3. **Role-Based Access Control (RBAC)**: Fine-grained permissions (`employee`, `manager`, `admin`, `auditor`) with file-level ACLs (`read`, `write`, `admin`).
4. **Approval Workflow**: Version changes submitted for manager approval; approvals recorded with wallet signatures.
5. **Transactional Audit Outbox**: Every mutation creates an atomic outbox record in the same database transaction.
6. **MST Blockchain Anchoring**: Outbox worker submits hashes and audit references to MST Testnet smart contracts without leaking file contents.
7. **Audit & Integrity Verification UI**: Deep-linked MSTScan transaction verification and integrity score monitoring.

---

## Mode Switches

OverVault supports running in simulated mode for offline testing and real mode for live blockchain and wallet interaction:

| Variable | Values | Purpose |
|---|---|---|
| `CHAIN_MODE` | `fake` / `real` (or `testnet`) | Backend: `fake` generates deterministic simulated tx hashes; `real` connects to live MST Testnet RPC |
| `AUTH_MODE` | `dev` / `wallet` | Backend: `dev` allows mock token login; `wallet` enforces EIP-191 BridgeKey signatures |
| `NEXT_PUBLIC_API_MODE` | `mock` / `real` | Frontend: `mock` intercepts via MSW; `real` proxies to FastAPI on `:8000` |
| `NEXT_PUBLIC_WALLET_MODE` | `mock` / `bridgekey` | Frontend: `mock` simulates BridgeKey extension; `bridgekey` interacts with installed extension |

---

## Repository Structure

```
OverVault/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── api/routes/       # Auth, Files, Versions, Permissions, Approvals, Audit
│   │   ├── auth/             # JWT and BridgeKey EIP-191 signature verification
│   │   ├── chain/            # ChainService interface: fake.py and real.py (Web3)
│   │   ├── models/           # SQLAlchemy models (User, File, Version, Outbox, etc.)
│   │   └── workers/          # Outbox worker for background blockchain submission
│   └── tests/                # 65 passing pytest unit and integration tests
├── contracts/                # Solidity smart contracts (Hardhat)
│   ├── src/                  # Audit.sol, Integrity.sol, Ownership.sol, Permission.sol
│   ├── deployed.testnet.json # Live deployed contract addresses and deploy txs
│   └── hardhat.config.js     # MST Testnet network configuration
├── frontend/                 # Next.js 14 + Tailwind CSS web application
│   ├── src/app/              # Dashboard, Vault, Approvals, Audit, Settings pages
│   ├── src/components/       # UI components, TxLink, HashChip, FileDrawer
│   └── src/lib/wallet/       # BridgeKey wallet adapter and mock provider
├── docs/                     # Documentation, ADRs, and verification guides
│   ├── demo-script.md        # Step-by-step hackathon presentation script
│   ├── mstscan-verification.md # Complete MSTScan proof logs and verification guide
│   ├── security-checklist.md # Security audit and control checklist
│   └── mainnet-checklist.md  # Production readiness and Mainnet promotion roadmap
└── e2e/                      # Playwright end-to-end test suite
```

---

## Quick Start

### 1. Environment Setup

```bash
# Copy root environment file
cp .env.example .env
```

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
pip install "web3>=7"

# Run tests
pytest

# Start backend server (port 8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install

# Typecheck
npm run typecheck

# Start development server (port 3000)
npm run dev
```

### 4. End-to-End Testing (Playwright)

```bash
# From repository root
npx playwright test
```

---

## Running with Live MST Testnet

To query live MST Testnet contracts:
```env
CHAIN_MODE=real
MST_RPC_URL=https://testnetrpc.mstblockchain.com
MST_CHAIN_ID=91562037
```
`RealChainService` reads deployed contract addresses automatically from `contracts/deployed.testnet.json`. Read operations (`verify_transaction`, `get_tx_status`, `get_audit_trail`) connect directly to the live chain without requiring a private key.

To submit new on-chain write transactions from the background outbox worker:
```env
MST_BACKEND_SIGNER_KEY=0x<funded_private_key_on_mst_testnet>
```

---

## Documentation

- [Hackathon Demo Script](docs/demo-script.md)
- [MSTScan Verification Walkthrough](docs/mstscan-verification.md)
- [Security Checklist](docs/security-checklist.md)
- [Mainnet Readiness Checklist](docs/mainnet-checklist.md)
