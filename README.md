# OverVault (MST Vault)

> **Enterprise-Grade Blockchain-Audited Decentralized Document Vault & Private Storage Mesh**  
> Anchored to the **MST Blockchain** with **BridgeKey Wallet** cryptographic signing.  
> *Private files never touch the chain — only cryptographic hashes, access grants, and audit proofs do.*

---

## 📸 System Interface & Live Showcase

### 1. Executive Security & Integrity Dashboard (Pavan)
The operational command center tracking cryptographic file proofs, storage quota, active access grants, pending multi-sig reviews, and real-time MSTScan transaction commits.
![OverVault Executive Dashboard](docs/screenshots/dashboard.png)

---

### 2. Private Decentralized Storage Node Network (Pavan & Vineeth)
Decentralized physical data sovereignty cluster. Organizations connect servers and computers across regions into an encrypted storage mesh with interactive topology visualization, health telemetry, and quorum replication controls.
![OverVault Storage Nodes Mesh](docs/screenshots/storage-nodes.png)

---

### 3. Encrypted Vault File Explorer (Pavan & Vineeth)
Drag-and-drop multipart binary file uploads with client-side SHA-256 pre-computation, AES-256-GCM encryption at rest, protection locks (`append_only` / `read_only`), and live on-chain hash verification.
![OverVault Vault Files Explorer](docs/screenshots/files.png)

---

### 4. Immutable Audit Trail & Explorer (Pavan & Vineeth)
Complete non-repudiable audit ledger tracking every upload, version revision, access grant, revocation, and node lifecycle event with clickable transaction hashes linking to MSTScan.
![OverVault Audit Trail](docs/screenshots/audit.png)

---

## ⚡ Dynamic Frontend & Backend Integration

The frontend (Next.js 14) and backend (FastAPI) are **dynamically connected and integrated end-to-end**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND (Next.js 14 - Port 3000/3001)                    │
│                                                                                        │
│  [ React Query Hooks ] ──▶ [ api/client.ts (fetchWithAuth) ] ──▶ [ JWT Token Manager ] │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ HTTP/JSON & Multipart (FormData)
                                           │ Bearer JWT (Automatic Dev-Auth Refresh)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND (FastAPI - Port 8000)                             │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────┐  │
│  │   API Routers (10)    │──▶│   Business Services (10)  │──▶│  Database & Storage   │  │
│  │  • /api/files         │   │  • hashing (SHA-256)      │   │  • SQLite / Postgres  │  │
│  │  • /api/nodes         │   │  • encryption (AES-256)   │   │  • Encrypted Chunks   │  │
│  │  • /api/approvals     │   │  • permissions (RBAC)     │   │  • Transactional      │  │
│  │  • /api/audit         │   │  • versioning             │   │    Outbox Table       │  │
│  └───────────────────────┘   └─────────────┬─────────────┘   └───────────────────────┘  │
│                                            │                                            │
│                                            ▼                                            │
│                              ┌───────────────────────────┐                              │
│                              │   Outbox Background Worker│                              │
│                              │  (Polls & Batches Events) │                              │
│                              └─────────────┬─────────────┘                              │
└────────────────────────────────────────────┼────────────────────────────────────────────┘
                                             │ JSON-RPC / Web3 Signatures
                                             ▼
                               ┌───────────────────────────┐
                               │       MST BLOCKCHAIN      │
                               │  (Immutable Verification) │
                               └───────────────────────────┘
```

### Key Integration Highlights
1. **Dynamic Mode (`NEXT_PUBLIC_API_MODE="real"`):**  
   Configured in `frontend/.env.local`. When active, MSW mock interceptors are bypassed and every interaction communicates directly with the live FastAPI server at `http://localhost:8000`.
2. **Self-Healing JWT Authentication:**  
   `frontend/src/lib/api/client.ts` uses `fetchWithAuth`. If any request receives an initial `401 Unauthorized` (e.g., token expired or server rebooted), it transparently re-authenticates against `/api/auth/dev-login`, updates `localStorage`, and retries the in-flight request without crashing the UI.
3. **Real Binary Streaming:**  
   Unlike mock JSON stubs, file uploads stream true binary `multipart/form-data` payloads to `/api/files`, and downloads stream verified `application/octet-stream` blobs directly through `api.getBlob()`, verifying the `X-Content-SHA256` header on receipt.
4. **Persona Identity Switching:**  
   The Settings identity switcher immediately fetches and stores a real JWT for the selected persona (`Asha Rao - Employee`, `Ravi Kumar - Manager`, `Meera Iyer - Admin`, `Kiran Shah - Auditor`), re-scoping RBAC permissions live across all views.
5. **Transactional Outbox Worker:**  
   The backend writes audit actions and blockchain sync events to an atomic database outbox. A background worker (`backend/app/workers/outbox_worker.py`) polls events every 5 seconds and synchronizes them to the MST Blockchain without blocking HTTP threads.

---

## 🌐 Private Decentralized Storage Node Network

OverVault eliminates single-point-of-failure cloud dependency by enabling organizations to attach physical and virtual compute instances into a private decentralized cluster:

* **Token-Based Registration:** Generate ephemeral, cryptographically random registration tokens (`mst-node-sec-...`) with one-line CLI installation commands for new node agents.
* **SVG Mesh Network Topology:** Live interactive constellation diagram visualizing node connectivity, regional clusters (US-East, EU-Frankfurt, AP-Bangalore, Edge DR), latency pings, and data transmission pulses.
* **Configurable Replication Policy:**
  * **Replication Factor:** Select 1x to 5x copies per document across cluster nodes.
  * **Write Quorum:** Enforce minimum healthy node confirmations (e.g. 2 of 3) before committing writes.
  * **Heartbeat Monitoring:** Automated liveness pings tracking uptime, used storage vs allocated quota, and health score.
* **Safe Decommissioning Wizard:** Evacuate chunks from retiring nodes to active peers before server removal, guaranteeing **zero data loss**.

---

## 🗂️ Project Directory Structure

```text
OverVault/
├── .env.example                                # Master environment variables template
├── README.md                                   # Project documentation & architecture
├── docs/                                       # Design guidelines and demo runbooks
│   ├── DESIGN.md                               # Apple Design System token specification
│   ├── demo-script.md                          # 6-Act end-to-end presentation walkthrough
│   ├── security-checklist.md                   # Zero-trust verification criteria
│   └── screenshots/                            # High-resolution application captures
│       ├── dashboard.png
│       ├── storage-nodes.png
│       ├── files.png
│       └── audit.png
│
├── frontend/                                   # [PAVAN'S WORKSPACE] Next.js 14 App Router
│   ├── .env.local                              # Active runtime env (NEXT_PUBLIC_API_MODE=real)
│   ├── package.json                            # Next 14, React 18, TanStack Query, Lucide
│   ├── tailwind.config.ts                      # Custom Apple Design tokens (ink, parchment, hairline)
│   └── src/
│       ├── app/
│       │   ├── layout.tsx                      # Root layout, Google Fonts (Inter), Providers
│       │   ├── providers.tsx                   # QueryClient, dynamic auth session, MSW bridge
│       │   └── (app)/                          # Authenticated application shell
│       │       ├── layout.tsx                  # Global sidebar & top navigation bar
│       │       ├── dashboard/page.tsx          # Integrity overview & summary cards
│       │       ├── files/page.tsx              # Vault files table & upload modal
│       │       ├── approvals/page.tsx          # Dual-quorum review inbox & diff inspector
│       │       ├── access/page.tsx             # Access grant management & request forms
│       │       ├── audit/page.tsx              # Immutable audit trail & MSTScan links
│       │       ├── nodes/page.tsx              # Decentralized storage node cluster dashboard
│       │       └── settings/page.tsx           # Persona switcher & network settings
│       │
│       ├── components/
│       │   ├── features/
│       │   │   ├── nodes/                      # Storage Node Feature Suite
│       │   │   │   ├── network-topology.tsx    # Interactive SVG mesh network visualization
│       │   │   │   ├── add-node-dialog.tsx     # Token generator & node agent installer
│       │   │   │   ├── decommission-modal.tsx  # Zero-data-loss safe node retirement
│       │   │   │   ├── replication-card.tsx    # Redundancy & quorum control form
│       │   │   │   └── node-table.tsx          # Node health & storage metrics table
│       │   │   ├── files/                      # File upload dropzone, drawer & tables
│       │   │   ├── approvals/                  # Inbox items, review card & diff viewer
│       │   │   ├── access/                     # Active grants table & request dialog
│       │   │   ├── audit/                      # Event filter bar & audit log table
│       │   │   ├── dashboard/                  # Cryptographic integrity status widget
│       │   │   └── versions/                   # Version history timeline & rollback
│       │   ├── layout/
│       │   │   ├── sidebar.tsx                 # Navigation sidebar with dynamic badge counts
│       │   │   └── topbar.tsx                  # Persona chip, connected wallet & breadcrumbs
│       │   └── ui/                             # Reusable Apple-styled design components
│       │       ├── badge.tsx, button.tsx, card.tsx, data-table.tsx, drawer.tsx, modal.tsx
│       │       ├── empty-state.tsx             # Rich contextual illustrations for zero data
│       │       ├── hash-chip.tsx               # Truncated monospace SHA-256 chip with copy
│       │       └── tx-link.tsx                 # Clickable explorer hyperlink to MSTScan
│       │
│       └── lib/
│           ├── config.ts                       # Environment variable parser
│           └── api/
│               ├── client.ts                   # Robust fetch wrapper with auto-auth retry
│               ├── token.ts                    # LocalStorage JWT token accessor
│               └── hooks/                      # TanStack Query custom hooks
│                   ├── useFiles.ts             # File query & multipart upload mutation
│                   ├── useNodes.ts             # Node cluster query & policy mutations
│                   ├── useApprovals.ts         # Approval inbox query & decision mutations
│                   ├── useAccess.ts            # Grant queries & permission request mutations
│                   └── useAudit.ts             # Paginated audit log & filter queries
│
└── backend/                                    # [VINEETH'S WORKSPACE] FastAPI Python Backend
    ├── requirements-dev.txt                    # FastAPI, SQLAlchemy 2, Alembic, Pytest, PyJWT
    ├── overvault.db                            # SQLite database (dev) / PostgreSQL (prod)
    └── app/
        ├── main.py                             # FastAPI factory, lifespan, CORS & background tasks
        ├── config.py                           # Pydantic BaseSettings, CORS origins, JWT secrets
        ├── db.py                               # SQLAlchemy engine & session factory
        ├── deps.py                             # Current user JWT extraction & RBAC role guards
        │
        ├── api/
        │   ├── router.py                       # Master API router aggregating all endpoints
        │   └── routes/
        │       ├── files.py                    # Multipart upload, blob download, hash verify
        │       ├── nodes.py                    # Node registry, token generation, decommission
        │       ├── approvals.py                # Dual approval workflows & decision actions
        │       ├── access.py / permissions.py  # Access grants, capability checks, revocations
        │       ├── audit.py                    # Flat & filtered immutable audit trail records
        │       ├── auth.py                     # Dev JWT login & wallet authentication
        │       ├── dashboard.py                # Vault statistics & aggregate metrics
        │       └── health.py                   # Liveness probe & service state
        │
        ├── models/                             # SQLAlchemy Declarative ORM Models
        │   ├── file.py                         # File entity (protection level, owner, current version)
        │   ├── version.py                      # Version entity (SHA-256, storage key, author)
        │   ├── permission.py                   # Access grants (read/write/admin, expiry timestamp)
        │   ├── approval.py                     # Multi-sig approval requests & review decisions
        │   ├── audit_outbox.py                 # Transactional outbox event records
        │   └── user.py                         # User entity (role: employee, manager, admin, auditor)
        │
        ├── schemas/                            # Pydantic v2 validation models
        │   ├── file.py, nodes.py, approval.py, permission.py, audit.py, auth.py
        │
        ├── services/                           # Core Domain Logic Layer
        │   ├── storage.py                      # Local file system storage key addressing
        │   ├── encryption.py                   # AES-256 Fernet payload encryption at rest
        │   ├── hashing.py                      # SHA-256 cryptographic digest computation
        │   ├── versioning.py                   # Immutable append-only revisions & rollbacks
        │   ├── permissions.py                  # Access resolution & grant lifecycle
        │   ├── approvals.py                    # Quorum calculation & approval state machine
        │   └── rbac.py                         # Least-privilege role capability verification
        │
        ├── workers/                            # Autonomous Asynchronous Background Daemons
        │   ├── outbox_worker.py                # Polls outbox events, batches & commits to chain
        │   └── expiry_job.py                   # Sweeps expired access grants on schedule
        │
        └── tests/                              # Comprehensive Pytest Suite (47/47 Passing)
            ├── conftest.py                     # TestClient fixtures, in-memory DB & auth headers
            ├── test_files.py                   # Upload, download & integrity test cases
            ├── test_nodes.py                   # Storage node registration & decommission tests
            ├── test_outbox_worker.py           # Outbox batching & FakeChainService confirmation
            ├── test_approvals.py               # Quorum review & decision constraints
            ├── test_permissions.py             # RBAC role access & expiration tests
            └── test_audit.py                   # Audit log generation & hashing tests
```

---

## 👥 Team Work Allocation & Deliverables

### Pavan (Frontend Lead & UI/UX Architect)
* **Design System Execution:** Built the UI following `docs/DESIGN.md` Apple Design System guidelines using tailored CSS tokens (`bg-parchment`, `text-ink`, `border-hairline`, glassmorphism, refined micro-animations).
* **Decentralized Storage Nodes UI:** Designed and developed the complete Node Management suite, featuring an interactive SVG constellation mesh network topology, token generation dialog, live replication policy card, and safe decommission preflight wizard.
* **API Modernization & Data Streaming:** Implemented real binary `FormData` uploads, streaming blob downloads (`api.getBlob()`), and resilient API retry wrappers (`fetchWithAuth`) for real-time synchronization with Vineeth's backend.
* **Dynamic Badges & Interactive States:** Added live polling approval counter badges in the sidebar, loading skeletons, responsive layouts, and rich empty states across all tables.

### Vineeth (Backend Lead & Systems Architect)
* **FastAPI Service Core:** Architected the modular FastAPI backend, incorporating asynchronous SQLAlchemy 2 ORM, Pydantic v2 schemas, and Alembic database migrations.
* **Storage Node Control Plane:** Implemented storage node registry endpoints (`/api/nodes`, `/api/nodes/token`, `/api/nodes/register`, `/api/nodes/{id}/allocation`, `/api/nodes/{id}/decommission`, `/api/nodes/replication-policy`).
* **Transactional Outbox Worker:** Created `workers/outbox_worker.py` to decouple web API requests from blockchain latency, reliably batching and committing events with automatic retry mechanisms.
* **Zero-Trust Security & RBAC:** Enforced AES-256-GCM encryption at rest, SHA-256 hash recalculation on every file read, least-privilege role boundaries, and scheduled grant expiration sweeping (`workers/expiry_job.py`).
* **Test Suite:** Authored a comprehensive Pytest suite containing 47 unit and integration tests covering all critical paths with 100% pass rate.

---

## 🚀 Quick Start & Verification

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

### 2. Start Backend (Vineeth's Zone)
```bash
cd backend
pip install -r requirements-dev.txt

# Run full test suite (47 passed)
python -m pytest

# Launch FastAPI development server (Port 8000)
uvicorn app.main:create_app --factory --reload --port 8000
```
*API interactive documentation will be available at:* `http://localhost:8000/docs`

### 3. Start Frontend (Pavan's Zone)
```bash
cd frontend
npm install

# Run development server (Port 3000 / 3001)
npm run dev
```
*Access the application in your browser at:* `http://localhost:3000` (or `http://localhost:3001`)

---

## 🔐 Demo Personas (Dev Authentication)

Switch personas instantaneously in the **Settings** tab to test role-based capabilities:

| Persona | Name | Role | Primary Permissions |
| :--- | :--- | :--- | :--- |
| `u1` | **Asha Rao** | `Employee` | Upload documents, request access, download granted files |
| `u2` | **Ravi Kumar** | `Manager` | Review and approve/reject document modification requests |
| `u3` | **Meera Iyer** | `Admin` | Full vault governance, node commissioning, storage allocation |
| `u4` | **Kiran Shah** | `Auditor` | Read-only inspection of cryptographic audit proofs & MSTScan hashes |

---

## 📄 License
MIT © 2026
