# OverVault

> **Blockchain-audited enterprise document storage** on MST Blockchain with BridgeKey Wallet for identity and signing. Private files never touch the chain — only hashes and references do.

## Features

- **AES-256 Encryption at Rest** — Files encrypted before storage, decrypted on verified download
- **SHA-256 On-Chain Proof** — Every document gets a cryptographic fingerprint committed to MST Blockchain
- **Role-Based Access Control** — 4 roles (Employee, Manager, Auditor, Admin) with least-privilege enforcement
- **Cryptographic Access Grants** — Time-limited permissions with automatic expiration and on-chain audit
- **Approval Workflows** — Multi-signature review for document changes with diff viewer
- **Immutable Audit Trail** — Every action logged with MSTScan verification links and CSV export
- **Version History** — Full document revision timeline with rollback capability

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Next.js UI    │────▶│  FastAPI Backend  │────▶│  MST Blockchain   │
│   (Port 3000)   │     │   (Port 8000)     │     │  (Testnet/Chain)  │
│                 │     │                   │     │                   │
│ • Dashboard     │     │ • Auth (JWT/Wallet)│    │ • Hash commits    │
│ • File Explorer │     │ • RBAC + Grants   │     │ • Audit proofs    │
│ • Audit Trail   │     │ • Encrypt/Hash    │     │ • MSTScan links   │
│ • Approvals     │     │ • Outbox Worker   │     │                   │
└─────────────────┘     └──────────────────┘     └───────────────────┘
```

## Repo Layout

| Folder | Owner | What it is |
|---|---|---|
| `frontend/` | Pavan | Next.js + Tailwind app (see `docs/DESIGN.md`) |
| `backend/` | Vineeth | FastAPI, storage, RBAC, hashing, approvals, chain outbox |
| `backend/app/chain/` + `contracts/` | Sriganesh | Smart contracts, MST Testnet deploys, chain service |
| `frontend/src/lib/wallet/`, `backend/app/auth/wallet_auth/`, `e2e/`, `docs/` | Pannaga | BridgeKey integration, E2E tests, docs |
| `specs/` | Shared | Frozen API interfaces |

## Quick Start

```bash
# 1. Clone and configure
git clone <repo-url> && cd OverVault
cp .env.example .env

# 2. Start backend
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# 3. Start frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` — the app runs with mock data by default.

### Docker (Production)

```bash
docker compose up --build
```

This starts both backend (`:8000`) and frontend (`:3000`) with health checks.

## Mode Switches

Swap mocks for the real thing one at a time:

| Variable | Values | Where | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` / `real` | Frontend | Switch between MSW mocks and live backend |
| `NEXT_PUBLIC_WALLET_MODE` | `mock` / `bridgekey` | Frontend | Switch between dev wallet and BridgeKey |
| `AUTH_MODE` | `dev` / `wallet` | Backend | Switch between seeded users and wallet auth |
| `CHAIN_MODE` | `fake` / `testnet` | Backend | Switch between fake chain and MST Testnet |

## Demo Users (Dev Mode)

| User | Role | Wallet |
|---|---|---|
| Asha Rao | Employee | `0xaaa1` |
| Ravi Kumar | Manager | `0xbbb2` |
| Meera Iyer | Admin | `0xccc3` |
| Kiran Shah | Auditor | `0xddd4` |

## Documentation

| Document | Description |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI design system, tokens, components |
| [`docs/demo-script.md`](docs/demo-script.md) | Step-by-step demo walkthrough |
| [`docs/security-checklist.md`](docs/security-checklist.md) | Security review checklist |
| [`docs/mstscan-verification.md`](docs/mstscan-verification.md) | How to verify proofs on MSTScan |
| [`docs/setup.md`](docs/setup.md) | Environment setup guide |

## Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS, TanStack Query, Lucide Icons, MSW
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic, Cryptography (Fernet)
- **Blockchain:** MST Testnet, BridgeKey Wallet, MSTScan Explorer
- **CI/CD:** GitHub Actions (backend tests, frontend build, e2e, contracts)
- **Infrastructure:** Docker Compose, SQLite (dev) / PostgreSQL (prod)

## License

MIT
