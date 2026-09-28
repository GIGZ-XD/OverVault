# OverVault — Work Division (4 people)

**Team:** Pavan · Ganesh · Vineeth (**Claude Code**) · Pannaga

## 1. Principle: who gets what

Vineeth runs Claude Code, so he gets the work that is **well-specified, code-heavy, repetitive, and easy to verify with tests**. An AI agent is fastest when the spec is clear and there is a test to check its output. That means the FastAPI backend, the database, the RBAC layer, hashing, versioning, tests and CI.

The three of you without an agent take the work that needs **judgement, external tools, browser/wallet interaction or design taste**. That means the frontend and design, the smart contracts and testnet, and the wallet integration and end-to-end demo.

| Person | Role | Owns |
|---|---|---|
| **Pavan** | Frontend + UX lead | Design system, all screens, Next.js app, API client |
| **Ganesh** | Blockchain lead | Smart contracts, MST Testnet, `mst-sdk-python` chain service, MSTScan verification |
| **Vineeth (Claude Code)** | Backend lead | FastAPI, storage, Postgres, RBAC, hashing, versioning, approval logic, tests, CI |
| **Pannaga** | Wallet + integration + QA lead | BridgeKey wallet auth and signing, audit dashboard wiring, E2E tests, demo, docs |

## 2. Ownership by module

| Module (from implementation plan) | Owner | Support |
|---|---|---|
| Phase 0: repo, CI, env configs | Vineeth | Pannaga (faucet, wallet installs) |
| Phase 0: VibeKit frontend scaffold | Pavan | — |
| Phase 1: encrypted storage, versioning, retrieval | **Vineeth** | — |
| Phase 1: Postgres schema, SHA-256 hashing | **Vineeth** | — |
| Phase 1: RBAC (employee/manager/admin/auditor) | **Vineeth** | — |
| Phase 2: 4 smart contracts (Ownership, Permission, Integrity, Audit) | **Ganesh** | Vineeth generates test scaffolds |
| Phase 2: Testnet deploy and MSTScan verification | **Ganesh** | Pannaga (verifies) |
| Chain service (async and batched writes via `mst-sdk-python`) | **Ganesh** | Vineeth (queue and worker) |
| Phase 3: BridgeKey connect, wallet-signature login | **Pannaga** | Pavan (UI), Vineeth (`/auth/wallet` endpoint) |
| Phase 3: transaction signing flows | **Pannaga** | Ganesh (contract calls) |
| Phase 4: employee workspaces and quotas | Vineeth (API) | Pavan (UI) |
| Phase 4: access control with expiry and revocation | Vineeth (API) | Ganesh (chain events), Pavan (UI) |
| Phase 4: protected files (read-only / append-only) | Vineeth | Pavan (UI) |
| Phase 4: version history and rollback | Vineeth (API) | Pavan (UI) |
| Phase 4: approval workflow | Vineeth (state machine) | Pannaga (signing), Pavan (UI) |
| Phase 4: audit trail dashboard | Pavan (UI) | Pannaga (data wiring), Ganesh (chain reads) |
| Phase 5: unit tests | Vineeth | — |
| Phase 5: contract tests | Ganesh | — |
| Phase 5: E2E and security review | **Pannaga** | All |
| Phase 6: demo script, walkthrough, docs | **Pannaga** | Pavan (slides/visuals) |

## 3. Phase-by-phase plan

### Phase 0: Setup (all in parallel)
- **Vineeth (Claude Code):** create the monorepo (`/frontend`, `/backend`, `/contracts`, `/docs`), write `CLAUDE.md`, scaffold FastAPI, set up Postgres via docker-compose, add GitHub Actions and `.env.example`.
- **Pavan:** run VibeKit scaffold in `/frontend`, set up Tailwind with the tokens in `DESIGN.md`, build the base layout.
- **Ganesh:** set up the contracts toolchain, install `mst-sdk-python`, get testnet RPC details.
- **Pannaga:** install BridgeKey on every dev machine, claim $MSTC from the faucet for all four people, and keep a shared test-accounts sheet (addresses only, never keys).
- **All:** agree the two contracts below in a 30-minute meeting (section 4). This is the most important step.

**Milestone M0:** repo runs locally, everyone has a funded wallet.

### Phase 1: Core backend (Vineeth), with parallel work by others
- **Vineeth:** storage service, encrypted upload/download, versions, SHA-256 hashing, RBAC, and an OpenAPI spec published early.
- **Pavan:** build the UI against **mock data** using the OpenAPI spec (login page, file explorer, upload flow).
- **Ganesh:** write the four contracts and local tests.
- **Pannaga:** prototype the BridgeKey connect and sign-message flow in a throwaway page.

**Milestone M1:** upload → encrypted store → hash → version works via API.

### Phase 2: Contracts on testnet (Ganesh)
- Deploy all four contracts to MST Testnet and verify each on MSTScan.
- Publish contract addresses and ABIs to `/contracts/deployed.testnet.json`.
- **Vineeth** builds the async job queue (outbox table plus worker) that the chain service plugs into.

**Milestone M2:** contracts live on testnet, verified on MSTScan.

### Phase 3: Wallet integration (Pannaga)
- Connect Wallet button, nonce → sign → verify → JWT flow, link user to wallet address.
- Signing for ownership registration, permission changes and approvals.

**Milestone M3:** log in with BridgeKey and sign a real testnet transaction.

### Phase 4: Feature build-out (everyone)
Run this as **vertical slices**, one feature at a time across the stack:

1. Upload with ownership registration (Vineeth API, Ganesh chain write, Pavan UI)
2. Version history and rollback
3. Access grants with expiry and revoke
4. Protected files
5. Approval workflow
6. Audit trail dashboard

For each slice: Vineeth ships the endpoint, Ganesh ships the on-chain event, Pavan ships the screen, and Pannaga tests it E2E.

**Milestone M4:** all core features complete.

### Phase 5 and 6: Test and demo (Pannaga leads)
- Full E2E: upload → hash → grant → wallet-signed approval → on-chain audit record → MSTScan link.
- Vineeth fills coverage gaps with generated tests. Ganesh runs the contract tests. Everyone does a security pass.
- Pannaga runs the demo rehearsal following the fixed sequence: Contract Development → Testnet Deployment → Wallet Connection → Transaction Verification.

**Milestones M5 and M6:** tests green, demo-ready.

## 4. Interfaces to agree first (Phase 0 meeting)

These two contracts let all four people work in parallel without blocking each other.

**A. REST API contract (Vineeth ↔ Pavan ↔ Pannaga)**
- Vineeth writes an OpenAPI spec first (endpoints, request/response shapes, error format, roles).
- Pavan generates a typed client from it and mocks it with MSW until the real backend is ready.
- Any change to the spec is announced in the group chat.

**B. Chain service contract (Ganesh ↔ Vineeth ↔ Pannaga)**
- Ganesh defines a small Python interface, for example:
  - `register_ownership(file_id, owner_address, hash)`
  - `record_permission(file_id, grantee, action, expiry)`
  - `commit_hash(file_id, version, hash)`
  - `log_audit(event_type, ref, actor)`
  - `get_audit_trail(file_id)`
- Vineeth codes against a **fake implementation** first, then swaps in Ganesh's real one.
- Pannaga uses the same interface for signing payloads.

## 5. Working with Claude Code (Vineeth's setup)

To get the most out of the agent:

1. **Write `CLAUDE.md` first.** Include the stack (FastAPI, Postgres, `hashlib`), the rule that private files never go on chain, coding style, folder layout, and how to run tests.
2. **Give it specs, not vibes.** Feed it `prd.md`, `architecture.md`, the OpenAPI outline and one module per task.
3. **Test-first.** Ask for pytest tests alongside each module so the agent can check its own work.
4. **One slice per branch.** Small PRs (storage, then RBAC, then versioning, and so on) are easier to review.
5. **Keep secrets away from it.** No private keys or real credentials in the repo. Use `.env` and testnet-only wallets.
6. **Human review is mandatory** for encryption, auth and RBAC code. Pannaga reviews these PRs since it is the security-critical path.
7. **Use it as a helper for others.** When Ganesh or Pavan are stuck on boilerplate (contract test scaffolds, typed API hooks), Vineeth can run a Claude Code task for them.

## 6. Ground rules

- Branches: `feat/<area>-<short-name>`; PRs need one review from a different person.
- Daily 10-minute sync: what I finished, what I'm blocked on, what I need from someone.
- Nothing merges to `main` with failing CI.
- Contract addresses and ABIs live only in `/contracts/deployed.testnet.json`.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Chain writes slow or flaky | Outbox queue with retries; UI shows "pending on-chain" state |
| Wallet integration delays the frontend | Auth scaffold from Phase 1 stays until M3 |
| Agent-written code has subtle security bugs | Human review of auth, crypto and RBAC; tests required |
| Ganesh becomes a bottleneck | Vineeth builds against the fake chain service so nobody waits |
| Merge conflicts | Clear folder ownership: `/frontend` Pavan, `/backend` Vineeth, `/contracts` Ganesh, `/docs` and `/e2e` Pannaga |
