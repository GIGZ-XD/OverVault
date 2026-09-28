# ADR 0006: Integrating Sriganesh's audit files - fixes and one open gap

Status: accepted, pending Sriganesh's confirmation on two points  ·  Owner: Vineeth

## What was delivered
`services/audit.py`, `models/audit_outbox.py`, `api/routes/audit.py`, `schemas/audit.py`.

## Bugs found and fixed
1. **Separate `Base`.** `models/audit_outbox.py` declared its own `DeclarativeBase`
   instead of importing the shared one from `models/base.py`. `AuditOutbox` was on a
   different metadata than every other model, so `Base.metadata.create_all()` and
   Alembic's autogenerate would never see the table - it would silently never get
   created. **Fixed:** import the shared `Base`. Confirmed by regenerating the
   migration: `audit_outbox` now appears alongside the other six tables.
2. **Bad import.** `api/routes/audit.py` did `from app.config import settings`, which
   doesn't exist (`config.py` only exports `get_settings()`). This was an immediate
   `ImportError` - silently swallowed by `api/router.py`'s `try/except ImportError`
   around including this route, so the endpoints never actually mounted. **Fixed:**
   removed; not needed once the next fix lands.
3. **Duplicate DB engine.** The same file opened its own SQLAlchemy engine/session
   instead of using `app/db.py` - his own comment already flagged this as temporary,
   pending `db.py` existing. It now does. **Fixed:** swapped to `app.db.get_db`, so
   audit writes made through this route share a transaction/connection with the rest
   of the app, per ADR 0003.
4. **No auth.** Neither endpoint required a JWT, unlike every other route. **Added**
   `get_current_user`, flagged for Sriganesh to confirm or revert - see the note in
   `routes/audit.py`.

## Signature mismatch (reconciled via an adapter, not by editing 11 call sites)
ADR 0003 assumed `record(actor_id, action, resource_type, resource_id, content_hash,
metadata)`. The delivered `record()` uses `(event_type, reference_id, actor,
payload)` - different names, and `reference_id` is a single field, not a
type+id pair.

Rather than change Vineeth's 11 existing call sites (`versioning.py`,
`permissions.py`, `protection.py`, `approvals.py`, `expiry_job.py`), his delivered
function is kept as `record_event()` unchanged, and `record()` is now a thin adapter
translating the ADR 0003 shape onto it:
* `actor_id=None` (system-triggered events, e.g. the expiry job) -> `actor="system"`,
  since `AuditOutbox.actor` is `NOT NULL`.
* `action` -> `event_type`.
* `reference_id` = the **file** the event is about: `resource_id` directly when
  `resource_type == "file"`, otherwise `metadata["file_id"]` (every non-file call
  site already includes it). This makes `GET /audit/{file_id}` return every event
  for that file, not just the ones whose primary resource literally is the file.
* `resource_type`, `resource_id` and `content_hash` are folded into `payload`
  alongside the caller's own `metadata` - nothing is dropped, just re-homed.

If Sriganesh would rather `record_event()` itself take the ADR 0003 shape, the
adapter can be deleted and the 11 call sites left exactly as they are today.

## Still missing: `services/outbox.py`
`audit.py` imports `outbox_service.create_event(...)`; that file was never delivered.
Without it every mutation in the app fails (everything calls `audit.record()`). A
**clearly-marked temporary stub** now lives at `app/services/outbox.py`: it builds an
`AuditOutbox` row, adds it to the session (does not commit), and returns it - no
`ChainService`, batching or retries. **Replace the whole file** with Sriganesh's real
one; nothing else changes when you do, since his `audit.py` already imports it by
this same name and call signature.

## Verified
* All 40 backend tests pass, including four new ones in
  `tests/test_audit_integration.py` that go through the real pipeline (not the
  `audit_calls` spy the other tests use) - a real mutation writes a real
  `AuditOutbox` row, the expiry job's system actor is non-null, and
  `GET /audit/{file_id}` returns the right trail, in order, and requires auth.
* Migration regenerated from scratch: `audit_outbox` is now created alongside the
  other six tables in one migration; `alembic check` is clean.

## Still needed for Phase 3
`app/chain/` (`base.py`, `fake.py`, `demo.py`, `real.py`, `batching.py`) and
`app/workers/outbox_worker.py` - the outbox rows this pipeline creates just sit at
`status="pending"` forever until those exist.
