# OverVault backend (Vineeth's zone)

FastAPI + SQLAlchemy 2 + Alembic. Runs standalone on dev auth + SQLite + local encrypted storage.

    cp ../.env.example .env
    pip install -r requirements-dev.txt
    uvicorn app.main:app --reload      # docs at http://localhost:8000/docs
    python -m pytest                   # 35 tests, no chain / wallet / UI needed
    alembic upgrade head               # production path (set AUTO_CREATE_TABLES=false)

Dev users (dev auth): admin@ / manager@ / employee@ / employee2@ / auditor@ `overvault.dev`
-> `POST /api/auth/dev-login {"email": ...}` returns a JWT.

## Layer rules followed
Routes -> Services -> Models. Services never touch the chain; they call `audit.record(...)`
and commit once, so the action and its outbox row share a transaction.

## Rules enforced
* SHA-256 of plaintext stored per version; verified on EVERY read; files encrypted at rest (Fernet).
* Rollback creates a new version (history is never rewritten).
* Protection: `append_only` = new versions only; `read_only` = frozen. Loosening a lock = admin only.
* Grants: expiry + revocation; re-grant updates in place; expired grants are ignored immediately and
  swept + audited by `workers/expiry_job.py`.
* Approvals: no self-review, no double decision; approving sets `file.approved_version`.
* Auditor: metadata/version hashes only, never file content (unless explicitly granted).

## Team dependencies  (see the chat summary for details)
| Needs | From | Status here |
|---|---|---|
| `services/audit.py` -> `audit.record(...)` | Sriganesh | **Placeholder stub** included - replace with his file, agree signature |
| `audit_outbox` model + migration | Sriganesh | `migrations/env.py` auto-imports it when it exists; then run `alembic revision --autogenerate` |
| `routes/audit.py` | Sriganesh | `api/router.py` auto-includes it when present |
| `auth/wallet_auth` (`nonce.issue_nonce`, `verify.verify_login`) | Pannaga | Routes coded to an **assumed** signature; return 501 until the module exists |
| `signing_payloads.json` / signature format | Pannaga + Sriganesh | Optional `signature` accepted on grant / revoke / approve / reject and stored in audit metadata; **not verified** |
| `specs/openapi.yaml` + fixtures | Vineeth (but scaffold copy unseen) | **Resolved to match Pavan's mock (ADR 0005)** - diff `make openapi` output against the frozen spec and update it |
| Upload/download real integration | Pavan | Mock uses JSON; real backend needs multipart upload + blob download - see ADR 0005 |
