# OverVault — Implementation Plan

## Phase 0: Setup
- Scaffold frontend/project structure using **VibeKit** (`@mstblockchain/mst-vibe-kit`)
- Set up **Python (FastAPI)** backend service; install **`mst-sdk-python`** for contract interaction
- Install **BridgeKey Wallet** Chrome extension for all dev machines
- Claim **$MSTC** testnet tokens from the MST Faucet for each developer/test account
- Set up repo, CI pipeline, environment configs (testnet RPC endpoints, contract addresses placeholder)

## Phase 1: Core Storage & Backend
- Build private encrypted storage layer (upload, versioning, retrieval) in FastAPI
- Build metadata database (files, versions, owners, permissions) in Postgres
- Implement authentication scaffold (to be swapped for wallet-based auth in Phase 3)
- Implement RBAC (roles: employee, manager, admin, auditor)
- Implement file hashing (SHA-256 via Python's `hashlib`/`cryptography`) on every upload/version

## Phase 2: Smart Contracts (MST Blockchain — mandatory)
- Design and write contracts for:
  1. Ownership Verification
  2. Permission Management
  3. Integrity Verification (hash commitments)
  4. Audit Verification (event log)
- Deploy contracts to **MST Testnet** (mandatory)
- Verify each deployment and subsequent transaction on **MSTScan**

## Phase 3: BridgeKey Wallet Integration (mandatory)
- Add "Connect Wallet" flow using BridgeKey Wallet extension
- Replace placeholder auth with wallet-signature-based login
- Implement transaction signing for: ownership registration, permission changes, approval actions
- Link application user accounts to MST Blockchain addresses

## Phase 4: Feature Build-Out
- Employee storage management (workspaces, quotas)
- Access control (temporary permissions, expiry, revocation) — writes permission-change events to chain
- Protected files (read-only / append-only enforcement)
- Version control UI (history, authorship, timestamps, rollback)
- Approval workflow (submit → manager review → approve/reject), each decision anchored on-chain
- Audit trail dashboard, pulling verified records via `mst-sdk-python` (backend) and cross-linking to MSTScan

## Phase 5: Testing & Validation
- Unit tests for backend services and hash verification
- Contract tests on MST Testnet: ownership writes, permission changes, integrity checks, audit events
- End-to-end test: upload → hash → permission grant → wallet-signed approval → on-chain audit record → MSTScan verification
- Security review: encryption, access control, least-privilege checks
- Load testing for private storage layer (blockchain calls mocked/batched to avoid throttling)

## Phase 6: Demo / Deployment Readiness
- Prepare demo flow following the deployment sequence: Smart Contract Development → MST Testnet Deployment → Wallet Connection → Transaction Verification
- Document mainnet promotion checklist (out of scope for v1 execution, but captured for future work)
- Publish audit trail + verification walkthrough (link transactions on MSTScan)

## Milestones Summary
| Milestone | Key Deliverable |
|---|---|
| M0 | Project scaffolded (VibeKit), SDKs installed, testnet wallets funded |
| M1 | Private storage + RBAC + hashing working end-to-end |
| M2 | Contracts written and deployed to MST Testnet, verified on MSTScan |
| M3 | BridgeKey Wallet login + transaction signing live |
| M4 | All core features (storage, access control, versioning, approvals, audit trail) complete |
| M5 | Full test suite passing; end-to-end wallet-signed audit flow verified |
| M6 | Demo-ready build with MSTScan-linked audit trail |

## Backlog / Future Work (not in this plan)
- MCP endpoint integration for AI-agent-driven audit queries
- TypeScript SDK usage if the frontend later needs direct client-side chain reads
- BridgeKey Android app support
- Multi-chain and zero-knowledge verification enhancements
