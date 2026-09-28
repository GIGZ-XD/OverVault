# CLAUDE.md - working agreement for OverVault

Read this before changing anything. It applies to Claude Code and to every teammate's AI assistant.

## Frozen decisions
The tech stack and the folder structure in `STRUCTURE.md` are FROZEN. Do not silently change or
substitute them. Improvements go under a separate "Optional Future Improvements" heading, never
into the code. Frozen contracts (`specs/openapi.yaml`, `specs/fixtures/`, `specs/chain_service.py`,
`specs/wallet_auth.md`, `specs/signing_payloads.json`) change only in ONE PR that updates the spec,
the fixtures and every consumer, reviewed by the owners on both sides.

## Who owns what
Vineeth: backend core, `frontend/src/lib/api`, `specs/`, `.github/`, root tooling, `docs/adr/`.
Sriganesh: `contracts/`, `backend/app/chain/`, audit + outbox. Pannaga: wallet, signing modal, audit UI,
`e2e/`, `docs/`. Pavan: frontend shell, UI primitives, pages, MSW mocks.
When a person says "I am <name>", stay inside their zone. Mention, but do NOT implement, any change
outside it (see `.github/CODEOWNERS` for the exact paths).

## Layer rules
* Routes (`backend/app/api`) receive HTTP, validate with schemas, call services. No business logic.
* Services hold business logic and coordinate models, storage, permissions and the audit outbox.
  They NEVER call the chain directly. They call `audit.record(...)` and commit ONCE at the end of the
  action so the action and its outbox row share a transaction. `audit.record` itself must not commit.
* Models store data only. Schemas must match `specs/openapi.yaml`.
* Chain is reached only through `ChainService` (`backend/app/chain/base.py`). Fake chain is the
  default for dev and tests.
* No blockchain write ever happens inside a request. Private files never go on-chain: only hashes
  and references.
* Domain errors (`NotFound`, `Forbidden`, `Conflict`, `Invalid`, `IntegrityViolation`) live in
  `services/rbac.py`; `main.py` maps them to HTTP responses.

## Backend commands (run from repo root)
    make install     # pip install backend requirements
    make run         # uvicorn on :8000, docs at /docs
    make test        # pytest (uses fake chain + in-memory SQLite; no wallet/UI needed)
    make migrate     # alembic upgrade head
    make openapi     # dump live schema to specs/openapi.generated.yaml for diffing

After changing a model: `cd backend && alembic revision --autogenerate -m "..."`, review the file,
and keep `alembic check` green (CI runs it).

## Git
Never commit to `main`. Branch `feature/<name>-...`, small PRs, rebase before opening, commit
messages `type: summary`. Never commit `.env`, private keys or seed phrases; only `.env.example`.
