# OverVault Frontend (Pavan's Zone)

> **Next.js 14 App Router + TypeScript + Tailwind CSS**  
> Designed according to the **Apple Design System** tokens specified in [`../docs/DESIGN.md`](../docs/DESIGN.md).

---

## ⚡ Dynamic Backend Connection

The frontend is dynamically configured to talk to the live FastAPI backend:

* **Config:** `frontend/.env.local` sets `NEXT_PUBLIC_API_MODE=real` and `NEXT_PUBLIC_API_URL=http://localhost:8000`.
* **API Client:** [`src/lib/api/client.ts`](src/lib/api/client.ts) wraps all HTTP calls with `fetchWithAuth`. It automatically sends Bearer JWT headers and self-heals by fetching a fresh dev token via `/api/auth/dev-login` if any call encounters a 401.
* **Binary Streaming:** File uploads stream raw binary `multipart/form-data` directly to FastAPI. File downloads stream verified `application/octet-stream` blobs via `api.getBlob()`, checking the `X-Content-SHA256` header on receipt.
* **Mock Fallback:** To run isolated UI tests without the backend, change `NEXT_PUBLIC_API_MODE=mock` in `.env.local` to enable Mock Service Worker (MSW).

---

## 🎨 Feature Modules & Architecture

* **Dashboard (`/dashboard`):** Real-time cryptographic integrity indicator, summary metric cards, storage capacity utilization, and MSTScan transaction activity.
* **Storage Nodes (`/nodes`):** Private Decentralized Storage Node Network suite:
  * **Interactive SVG Mesh Topology:** Constellation graph rendering node clusters, latency, and data transmission pulse animations.
  * **Node Management:** Registration token generator dialog, copyable agent CLI commands, and preflight safe decommission modal.
  * **Replication Controls:** Redundancy factor (1x-5x), quorum write thresholds, and heartbeat intervals.
* **Vault Files (`/files`):** Multipart drag-and-drop upload dropzone, SHA-256 hash chips, protection mode toggles (`append_only` / `read_only`), and instant on-chain verification.
* **Approvals (`/approvals`):** Multi-signature document review inbox with dynamic sidebar badge counters and side-by-side diff comparison viewer.
* **Access Control (`/access`):** Time-bound access grants, cryptographic tickets, and request modal with custom justification notes.
* **Audit Trail (`/audit`):** Filterable event log with clickable links directly navigating to transaction hashes on MSTScan.
* **Settings (`/settings`):** Persona identity switcher (`u1 Asha Rao`, `u2 Ravi Kumar`, `u3 Meera Iyer`, `u4 Kiran Shah`) automatically reissuing JWTs for live RBAC testing.

---

## 🛠️ Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (Port 3000 / 3001)
npm run dev

# 3. Production build verification
npm run build
```
