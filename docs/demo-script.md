# OverVault Demo Script

**Duration:** ~10 minutes  
**Presenter:** Pavan / Pannaga  
**Prerequisites:** Backend running on `:8000`, Frontend on `:3000`, API mode set to `mock` or `real`

---

## Act 1: Login & Dashboard (2 min)

1. Open `http://localhost:3000` — lands on the login page
2. Click **Sign in with Dev Account** (dev auth mode) or **Connect BridgeKey Wallet** (wallet mode)
3. **Dashboard loads** — point out:
   - Summary cards: total files, verified files, pending approvals, active permissions
   - Integrity score percentage
   - Recent documents table with inline verification badges
   - Blockchain integrity panel (MST Testnet status, contract address, outbox sync)

> **Key message:** "OverVault gives you an instant view of your document security posture."

## Act 2: Upload & Verify a Document (2 min)

1. Click **Upload Document** button
2. Enter document name (e.g., `board-resolution-2026.pdf`), select protection mode
3. Click **Upload** — toast confirms registration on MST Blockchain
4. Click the file in the table → **File Detail Drawer** opens
5. Show the **Overview** tab:
   - SHA-256 hash displayed as a mono chip
   - Ownership transaction link (would open MSTScan)
   - Verification status badge: ✅ Verified
6. Click **Verify On-Chain Hash** in the drawer footer
7. Toast confirms: "SHA-256 hash verified on MST Blockchain"

> **Key message:** "Every document gets a cryptographic fingerprint anchored to the blockchain. You can re-verify anytime."

## Act 3: Access Control & Permissions (2 min)

1. Navigate to **Access Control** in sidebar
2. Show the user directory grid (4 roles: employee, manager, admin, auditor)
3. Click **Grant Access** → select a user, permission level (read/write), expiry date
4. Grant issued — toast confirms with on-chain audit
5. Show the active grants table with countdown timers
6. **Revoke** a grant — show the signed revocation flow

> **Key message:** "Access is cryptographically enforced with automatic expiration. Every grant and revoke is audited on-chain."

## Act 4: Approval Workflows (1.5 min)

1. Navigate to **Approvals** in sidebar
2. Show existing pending approval request
3. Click to review — **Approval Review Modal** opens with:
   - Diff viewer showing proposed changes
   - Reviewer comment field
4. Click **Approve** — toast confirms signed approval
5. Show the approval status update from "Pending" → "Approved"

> **Key message:** "Multi-signature approval ensures no document changes without authorized review."

## Act 5: Audit Trail (1.5 min)

1. Navigate to **Audit Trail** in sidebar
2. Show the summary stats: Verified / Pending / Integrity Alerts
3. Demonstrate filters:
   - Filter by event type (e.g., "Access Granted")
   - Filter by verification status
   - Search by actor name
4. Click a transaction hash chip — "This would open MSTScan"
5. Click **Export CSV** — download audit report

> **Key message:** "Every action is immutably logged. Auditors get a one-click view of the entire document lifecycle."

## Act 6: Settings & Configuration (1 min)

1. Navigate to **Settings**
2. Show user identity card with role badge
3. Switch between user identities (employee → manager → auditor) to demo RBAC
4. Show API mode toggle (mock vs real backend)
5. Click **Test Health Endpoint** — badge shows "Status: ok"
6. Show MST Blockchain parameters (network, chain ID, explorer URL)

> **Key message:** "OverVault supports flexible deployment modes and role-based views."

---

## Closing Statement

> "OverVault provides enterprise-grade document management with blockchain-backed integrity. Files are encrypted at rest, every action is audited on-chain, and access control is cryptographically enforced — all without exposing private data to the blockchain."

## Architecture Highlights to Mention

- **Privacy:** Files never touch the chain — only SHA-256 hashes
- **Encryption:** AES-128 (Fernet) at rest, TLS in transit
- **RBAC:** 4 roles with least-privilege capabilities
- **Auditability:** MST Blockchain + outbox pattern for reliable chain writes
- **Tech stack:** Next.js + FastAPI + SQLite/PostgreSQL + MST Testnet + BridgeKey Wallet
