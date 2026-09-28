# OverVault — Fully Parallel Work Plan

**Team:** Pavan · Ganesh · Vineeth (Claude Code) · Pannaga

This replaces the earlier split. The goal is that **nobody waits on anybody** from hour 2 onward. Each person builds a vertical track with **their own mocks of the other tracks**, then we swap mocks for the real thing one at a time.

## 1. The idea in one picture

```
 PAVAN                 VINEETH (Claude Code)      GANESH                  PANNAGA
 /frontend             /backend                   /contracts + /chain     /wallet + /e2e + /docs
 UI + design system    API, storage, RBAC         4 contracts, testnet    BridgeKey, signing,
                       hashing, approvals         ChainService (real)     audit read, E2E, demo
      │                     │                          │                       │
 uses MOCK API         uses FAKE ChainService     tests with scripts      uses MOCK API +
 uses MOCK wallet      uses DEV auth              (no backend needed)     standalone demo page
      └──────────── all agree on 4 spec files (frozen in Hour 0-2) ──────────┘
```

## 2. Hour 0-2: The Freeze (all 4 together, the only blocking step)

Each person writes **one spec file** and the group reviews it. After this, specs change only by announcement in the group chat.

| Spec file (in `/specs`) | Written by | Contains | Who consumes it |
|---|---|---|---|
| `openapi.yaml` | **Vineeth** (with Claude Code) | Every endpoint, request/response, error format, roles | Pavan, Pannaga |
| `chain_service.py` (Protocol) | **Ganesh** | `register_ownership`, `record_permission`, `commit_hash`, `log_audit`, `get_audit_trail`, each with typed args and return `{tx_hash, status}` | Vineeth, Pannaga |
| `signing_payloads.json` + `wallet_auth.md` | **Pannaga** | The exact message shown/signed for each action (ownership, grant, revoke, approve); nonce → sign → verify login flow | Pavan, Vineeth, Ganesh |
| `fixtures/` + `ui_inventory.md` | **Pavan** | Sample JSON for files, versions, users, audit events, plus the screen and component list | Everyone (test data) |

Also decided in this hour: repo layout, branch rules, and the **three mode switches**:

```
NEXT_PUBLIC_API_MODE = mock | real      (frontend)
AUTH_MODE            = dev  | wallet    (backend)
CHAIN_MODE           = fake | testnet   (backend)
```

## 3. Folder ownership (no merge conflicts)

| Folder | Owner |
|---|---|
| `/frontend` (except `lib/wallet`) | Pavan |
| `/backend` (except `auth/wallet_auth` and `chain/`) | Vineeth |
| `/contracts`, `/backend/chain/` | Ganesh |
| `/frontend/lib/wallet`, `/backend/auth/wallet_auth`, `/e2e`, `/docs` | Pannaga |
| `/specs` | Shared, change by announcement |

## 4. Tracks

### Track A: Pavan, Frontend and design (100% independent)
**Mocks used:** MSW mock of the whole REST API (from `openapi.yaml` and fixtures); a `MockWalletAdapter` with the same interface Pannaga will implement.

Build order (each screen is fully usable on mock data):
1. VibeKit scaffold, Tailwind tokens from `DESIGN.md`, app shell, theme toggle
2. Shared components: buttons, tables, badges, hash chip, tx link, modal, toast
3. Login / Connect Wallet screen (mock adapter)
4. File explorer and upload dropzone
5. File detail drawer with version history and compare
6. Access control (grant / revoke / expiry)
7. Approvals inbox with diff viewer
8. Audit trail table
9. Dashboard

**Also owns:** the generic 3-step signing modal component (confirm → signing → result) that all on-chain actions use.
**Done when:** every screen works end to end with `API_MODE=mock`, including loading, empty, error and pending-chain states.
**Never waits on:** backend, chain, wallet.

### Track B: Vineeth, Backend (Claude Code) (100% independent)
**Mocks used:** `FakeChainService` (returns fake tx hashes, marks confirmed after a delay); `AUTH_MODE=dev` (issue JWT for a chosen test user).

Split into parallel Claude Code tasks (run several agents or branches at once):
1. **Foundation:** repo, docker-compose (Postgres), config, GitHub Actions, `CLAUDE.md`
2. **Storage:** encrypted upload/download, SHA-256 per version, hash verify on read
3. **Metadata and RBAC:** schema (users, files, versions, permissions, approvals, audit_outbox), roles employee/manager/admin/auditor
4. **Versioning and protection:** history, rollback, read-only / append-only enforcement
5. **Permissions:** grants with expiry, revocation, expiry job
6. **Approval state machine:** submit → review → approve/reject
7. **Chain outbox worker:** every state change writes an outbox row; a worker calls `ChainService` asynchronously with retries (this is what keeps chain writes off the request path)
8. **Tests:** pytest for every module, written alongside the code

**Done when:** all endpoints in `openapi.yaml` pass tests with `CHAIN_MODE=fake` and `AUTH_MODE=dev`, and the OpenAPI served by FastAPI matches the frozen spec.
**Never waits on:** contracts, wallet, frontend.

### Track C: Ganesh, Blockchain (100% independent)
**Mocks used:** none needed. Contracts and chain service are tested with standalone scripts and testnet transactions.

Order:
1. Toolchain, `mst-sdk-python`, testnet RPC, faucet funds
2. Four contracts, each with its own tests: **Ownership**, **Permission**, **Integrity** (hash commitments), **Audit** (event log)
3. Deploy each to **MST Testnet**, verify on **MSTScan**, save addresses and ABIs to `/contracts/deployed.testnet.json`
4. Implement `RealChainService` (`CHAIN_MODE=testnet`) that satisfies Ganesh's own Protocol from the freeze
5. Batching and retry logic for chain writes; gas and error handling
6. Read helpers: `get_audit_trail`, `verify_hash(file_id, version, hash)`
7. A CLI script (`python -m chain.demo`) that exercises all four contracts end to end without the backend

**Done when:** the CLI demo writes and reads all four record types on testnet and every tx is visible on MSTScan.
**Never waits on:** backend, frontend, wallet.

### Track D: Pannaga, Wallet, integration, QA and demo (100% independent)
**Mocks used:** MSW mock API for the login demo page; `FakeChainService` from the spec.

Order:
1. Install BridgeKey on all machines, claim $MSTC for everyone, keep a shared sheet of test addresses
2. **Standalone wallet demo page** (`/frontend/lib/wallet` plus a tiny test page): detect extension, connect, get address, sign a message, send a testnet transaction
3. `RealWalletAdapter` implementing the same interface as Pavan's mock
4. Backend `wallet_auth` module: nonce endpoint, signature verification, address → user link (plugs into `AUTH_MODE=wallet`)
5. Signing helpers that build and sign the payloads defined in `signing_payloads.json`
6. E2E test harness (Playwright plus pytest) written against mocks first, so tests exist before integration
7. Docs: setup guide, architecture diagram, MSTScan verification walkthrough
8. Demo script and slides (with Pavan's visuals), and the security review checklist

**Done when:** a real BridgeKey wallet can log in and sign a testnet tx from the demo page, and the E2E suite passes on mocks.
**Never waits on:** anyone.

## 5. Dependency matrix (nobody blocks anybody in Wave 1)

| | needs from Pavan | Vineeth | Ganesh | Pannaga |
|---|---|---|---|---|
| **Pavan** | — | mock API (own) | — | mock wallet (own) |
| **Vineeth** | — | — | fake chain (own) | dev auth (own) |
| **Ganesh** | — | — | — | — |
| **Pannaga** | mock fixtures (frozen) | mock API (own) | fake chain (own) | — |

Everything each person needs in Wave 1 is either their own mock or a frozen spec file.

## 6. Waves

### Wave 1: Build in parallel (largest block of time)
Each track works alone against mocks. **Sync:** 10-minute daily standup, and each person demos their track working on mocks.

| Milestone | Track |
|---|---|
| A1 | All screens work on mock API |
| B1 | All endpoints pass tests on fake chain and dev auth |
| C1 | Four contracts live on testnet and verified on MSTScan |
| D1 | Wallet demo page signs a real tx; E2E suite passes on mocks |

### Wave 2: Swap mocks for real, one switch at a time
Do these in order, each takes short pairs, and **each swap is just a config change** because of the frozen interfaces.

| Swap | Who pairs | Switch | Check |
|---|---|---|---|
| 1. Frontend → real backend | Pavan + Vineeth | `API_MODE=real` | Screens work against live API with dev auth |
| 2. Backend → real chain | Vineeth + Ganesh | `CHAIN_MODE=testnet` | Upload creates an ownership tx visible on MSTScan |
| 3. Dev auth → wallet auth | Pannaga + Vineeth | `AUTH_MODE=wallet` | Log in with BridgeKey |
| 4. Mock wallet → real wallet in UI | Pannaga + Pavan | swap adapter | Signing modal drives real BridgeKey prompts |

### Wave 3: Full-system hardening
- Pannaga runs the full E2E: upload → hash → grant → wallet-signed approval → on-chain audit record → MSTScan link.
- Ganesh and Vineeth fix chain edge cases (retries, failed writes, pending state).
- Pavan polishes states and accessibility; Vineeth fills test gaps.
- All four do the security pass; a human reviews all auth, crypto and RBAC code.

### Wave 4: Demo
Pannaga leads rehearsal in the fixed order: Contract Development → Testnet Deployment → Wallet Connection → Transaction Verification.

## 7. Work balance and load-sharing

| Person | Load | Extra capacity used for |
|---|---|---|
| Vineeth (Claude Code) | Heaviest by volume, but agent-accelerated | Runs several agent tasks in parallel; after B1, also generates contract test scaffolds for Ganesh and typed hooks for Pavan |
| Pavan | Heavy (9 screen groups) | Uses AI help for component boilerplate; gets Vineeth's typed client |
| Ganesh | Medium, high difficulty | Takes over `/chain` polish and batching while others integrate |
| Pannaga | Medium, spread wide | Absorbs docs, demo, QA; helps Pavan with a few screens if Wave 1 runs behind |

If a track finishes early, it helps the most loaded one, **starting with Pavan's screens 7 to 9** (Approvals, Audit Trail, Dashboard) since those are the largest chunk.

## 8. Claude Code setup for Vineeth

- `CLAUDE.md` with: stack, "private files never go on chain", folder layout, the three mode switches, test commands, and "never touch `/specs` without a note".
- Tasks written as: *goal → files to touch → acceptance test*. One task per branch.
- Ask for tests with every module so the agent can check its own output.
- Keep private keys and real credentials out of the repo; use `.env` and testnet-only wallets.
- Review auth, encryption and RBAC PRs by hand (Pannaga reviews).

## 9. Ground rules

- One branch per task: `feat/<track>-<name>`. PR needs one review from another person.
- CI must be green before merge to `main`.
- Spec change = post in group chat + update `/specs` + tag affected owners.
- Contract addresses and ABIs live only in `/contracts/deployed.testnet.json`.
- Standup every day: done, next, blocked.

## 10. Risks

| Risk | Fix |
|---|---|
| Spec drift breaks a swap | Freeze in Hour 0-2; FastAPI's generated OpenAPI is diffed against `/specs` in CI |
| One track is late | Others keep working on mocks; nothing downstream is blocked |
| Testnet flaky or out of $MSTC | Fake chain keeps everything else moving; Pannaga tops up from faucet |
| BridgeKey behavior differs from expectations | Pannaga discovers this early via the standalone demo page |
| Agent-written security bugs | Mandatory human review of auth, crypto, RBAC |
