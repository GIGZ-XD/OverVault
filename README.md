# OverVault

Blockchain-audited enterprise storage and document management, built on **MST Blockchain**
(MST Testnet) with **BridgeKey Wallet** for identity and transaction signing.
Private files never touch the chain, only hashes and references do.

## Repo layout

| Folder | Owner | What it is |
|---|---|---|
| `frontend/` | Pavan | Next.js + Tailwind app (see `docs/DESIGN.md`) |
| `backend/` | Vineeth (Claude Code) | FastAPI, storage, RBAC, hashing, approvals, chain outbox |
| `backend/app/chain/` + `contracts/` | Ganesh | Smart contracts, MST Testnet deploys, chain service |
| `frontend/src/lib/wallet/`, `backend/app/auth/wallet_auth/`, `e2e/`, `docs/` | Pannaga | BridgeKey integration, E2E tests, docs, demo |
| `specs/` | Shared | Frozen interfaces. Change by announcement only |

## Quick start

```bash
cp .env.example .env
make up            # postgres + minio via docker compose
make backend       # FastAPI on :8000  (AUTH_MODE=dev, CHAIN_MODE=fake)
make frontend      # Next.js on :3000  (NEXT_PUBLIC_API_MODE=mock)
```

## Mode switches (swap mocks for the real thing one at a time)

| Variable | Values | Where |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` / `real` | frontend |
| `NEXT_PUBLIC_WALLET_MODE` | `mock` / `bridgekey` | frontend |
| `AUTH_MODE` | `dev` / `wallet` | backend |
| `CHAIN_MODE` | `fake` / `testnet` | backend |

## Docs
Start with `docs/planning/PARALLEL_PLAN.md`, then `docs/setup.md`.

## Project Phase Status

### Phase 3 — Production Audit Pipeline ✅
- **Event-Driven Audit Pipeline:** Full transactional PostgreSQL Outbox with immutable `AuditEvent` model.
- **Reliable Outbox Processing:** Worker reliability with deterministic exponential retry delays (5s, 30s, 5m, 30m, 1h) and dead-letter queue.
- **Blockchain Anchoring Pipeline:** Seamless event routing to `RealChainService` (MST EVM) with gas estimation buffer and receipt confirmation.
- **Verification APIs:** `GET /audit/{file_id}`, `GET /audit/{file_id}/verify`, and `GET /transaction/{tx_hash}`.
- **Documentation:** [docs/PHASE_3_PRODUCTION_AUDIT_PIPELINE.md](file:///run/media/gigz/New%20Volume/Projects/2026/overvault/docs/PHASE_3_PRODUCTION_AUDIT_PIPELINE.md)

### Phase 2 & Phase 6 — RealChain MST EVM Integration ✅
- **Phase 6A:** [docs/Phase6A_MST_Connection_Check_README.md](file:///run/media/gigz/New%20Volume/Projects/2026/overvault/docs/Phase6A_MST_Connection_Check_README.md)
- **Phase 6B:** [docs/Phase6B_MST_EVM_Deployment_README.md](file:///run/media/gigz/New%20Volume/Projects/2026/overvault/docs/Phase6B_MST_EVM_Deployment_README.md)
- **Phase 6C:** [docs/Phase6C_MST_Testnet_Validation_README.md](file:///run/media/gigz/New%20Volume/Projects/2026/overvault/docs/Phase6C_MST_Testnet_Validation_README.md)
- **Phase 2:** [docs/PHASE_2_REAL_CHAIN_INTEGRATION.md](file:///run/media/gigz/New%20Volume/Projects/2026/overvault/docs/PHASE_2_REAL_CHAIN_INTEGRATION.md)

