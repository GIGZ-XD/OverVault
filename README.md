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
