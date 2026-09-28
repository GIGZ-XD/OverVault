# OverVault — Architecture Document

> **Note on tech stack:** the source report described system *layers* but did not specify concrete technologies. The stack below is a recommended, hackathon-appropriate choice consistent with the mandatory MST Blockchain / MST Testnet / BridgeKey Wallet requirements and the official MST developer tooling. Swap freely where the team has stronger preferences — the layer boundaries matter more than the specific libraries.

## 1. System Layers

### Frontend Layer
Dashboards, file management, search, and workflow (approval) interfaces.

### Backend Layer
Authentication, authorization, storage operations, policy engine, notifications, and blockchain communication.

### Private Storage Layer
Encrypted documents, file versions, replicas, and confidential metadata. **Never** touched by the blockchain layer directly — only hashes/references cross the boundary.

### MST Blockchain Layer
Stores ownership references, permission records, hash commitments, and audit proofs.

### BridgeKey Wallet Layer
Provides user blockchain identity, transaction signing, and secure authorization.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Frontend   │────▶│   Backend   │────▶│  Private Storage  │
│ (dashboard) │     │ (API/logic) │     │   (encrypted)     │
└─────────────┘     └──────┬──────┘     └──────────────────┘
                            │  hashes / refs only
                            ▼
                 ┌────────────────────┐      ┌──────────────────┐
                 │   MST Blockchain    │◀────▶│ BridgeKey Wallet │
                 │ (ownership, audit)  │ sign │ (identity/sign)  │
                 └────────────────────┘      └──────────────────┘
```

## 2. Recommended Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Next.js), Tailwind CSS |
| Backend / API | Python (FastAPI) |
| Auth | Session/JWT + BridgeKey wallet-signature auth |
| Private storage | Encrypted object storage (e.g. S3-compatible bucket) + Postgres for metadata/permissions |
| File integrity | SHA-256 hashing per file version (Python `hashlib`/`cryptography`) |
| Blockchain | MST Blockchain (MST Testnet for dev/test, promotion path to mainnet) |
| Contract interaction | `mst-sdk-python` from the backend |
| Scaffolding | `@mstblockchain/mst-vibe-kit` (VibeKit) for initial project/frontend bootstrap |
| Wallet | BridgeKey Wallet (Chrome extension) for identity + transaction signing |
| Testnet tokens | MST Faucet ($MSTC) for development/testing gas |
| Verification | MSTScan explorer for on-chain transaction/proof verification |
| CI/CD | GitHub Actions |

> **Why Python here:** FastAPI gives typed, low-boilerplate APIs, and Python's crypto/hashing ecosystem (`cryptography`, `hashlib`) is a strong fit for the integrity-verification work this system leans on. It also sets up naturally for the "AI-based document classification" future enhancement. The trade-off is losing a single language across frontend and backend (React/TS frontend + Python backend) — acceptable here since the frontend and blockchain-integration code are fairly decoupled.

## 3. MST Blockchain Integration (mandatory)
Used as the trust/verification layer for:
1. **Ownership Verification** — on-chain references proving document ownership
2. **Permission Management** — records of access grants, revocations, and permission changes
3. **Integrity Verification** — stored file hashes to detect unauthorized modification
4. **Audit Verification** — tamper-resistant records of important events

Smart contracts are written for these four record types and interacted with from the backend via the Python SDK (`mst-sdk-python`).

## 4. MST Testnet Deployment (mandatory)
Deployment flow:

```
Smart Contract Development
        │
        ▼
 MST Testnet Deployment
        │
        ▼
   Wallet Connection
        │
        ▼
 Transaction Verification
```

Testnet is used to deploy/test contracts, verify transactions, test wallet connectivity, validate permission workflows, and safely debug blockchain interactions before any production deployment.

## 5. BridgeKey Wallet Integration (mandatory)
BridgeKey Wallet provides blockchain identity and transaction authorization:
- User authentication through wallet connection
- Digital signing of blockchain transactions
- Secure approval of ownership/permission actions
- Linking application users to MST Blockchain accounts

## 6. Security Architecture
- Encryption of stored files (at rest and in transit)
- Authentication and authorization controls, least-privilege access
- Hash verification on every read/write
- Secure wallet-based signing for all state-changing blockchain actions
- Protected, encrypted backups

## 7. MST Developer Resources — used vs. not used

**Used:**
- **BridgeKey Wallet Extension** — primary identity/signing mechanism (mandatory requirement)
- **Faucet ($MSTC)** — required to fund testnet accounts for development/testing gas
- **Python SDK (`mst-sdk-python`)** — primary means of contract interaction from the FastAPI backend, matching the chosen Python stack
- **VibeKit (`@mstblockchain/mst-vibe-kit`)** — used to scaffold the frontend/project structure at setup time (VibeKit itself is a Node-based CLI tool; this doesn't conflict with a Python backend)
- **MSTScan Explorer** — used to verify testnet transactions and audit proofs during development and demos
- **Official docs (docs.mstblockchain.com)** — used as the build reference throughout

**Not used (with reasoning):**
- **TypeScript SDK (`@mstblockchain/mst-sdk`)** — the backend is Python, so contract interaction goes through `mst-sdk-python` instead; the TS SDK isn't needed unless the frontend later needs direct client-side chain reads (currently all chain access is proxied through the backend).
- **MCP Endpoint (`mcp.mstblockchain.com`) + OAuth credentials** — not required for the core storage/audit product. Flagged as a strong candidate for a *future* AI-agent feature (e.g., natural-language audit queries or automated compliance checks per the PRD's "Future Enhancements"), but out of scope for v1.
- **BridgeKey Android App** — no mobile-native client is in scope for v1 (see PRD "Out of Scope"); the web app plus Chrome extension covers the core flow.
