# OverVault — Phase 4: Audit API

## Objective

Expose the audit outbox pipeline through HTTP API endpoints so that application code, admin tooling, and other services can:

1. **Record audit events** via `POST /audit/record` — validated, stored immediately in `AuditOutbox` as `pending`
2. **Query the audit trail** for any file via `GET /audit/{file_id}` — returns the full chronological event history including blockchain confirmation status

This phase closes the loop between the application layer and the audit pipeline built in Phases 1–3. No blockchain calls are made in the API layer — submission remains exclusively the responsibility of the outbox worker.

---

## Implementation Summary

### What was implemented

**`POST /audit/record`**
- Accepts an `AuditEventCreate` body (validated by Pydantic)
- Calls `audit_service.record()` to persist the event in `AuditOutbox` with `status=pending`
- Commits the DB session and returns `AuditEventResponse` with HTTP 201

**`GET /audit/{file_id}`**
- Queries `AuditOutbox` for all rows matching `reference_id == file_id`
- Returns an ordered list of `AuditTrailResponse` objects, oldest-first
- Returns an empty list (`[]`) — not 404 — when no events exist (absence of events is valid)

### How it connects to the existing pipeline

```
POST /audit/record
        │
        ▼
audit_service.record(db, event_type, reference_id, actor, payload)
        │
        ▼
outbox_service.create_event()  →  AuditOutbox row (status="pending")
        │
        ▼
[async] outbox_worker.process_pending_events()
        │
        ▼
ChainService.log_audit() / commit_hash() / …
        │
        ▼
MST EVM  →  tx_hash stored  →  status="confirmed"
        │
        ▼
GET /audit/{file_id}  ←  returns trail including confirmed tx_hash
```

### Important technical decisions

| Decision | Rationale |
|---|---|
| **Self-contained `get_db()` in the route file** | `db.py` (Vineeth's) is a stub. Rather than leaving routes broken, a local dependency is defined. Tests override it via `dependency_overrides`. When `db.py` is ready, replace with `from app.deps import get_db`. |
| **`StaticPool` + `check_same_thread=False` in tests** | FastAPI `TestClient` runs requests in a worker thread. A `StaticPool` ensures the same SQLite in-memory connection is used across threads, so table creation and inserts are visible to the handler. |
| **`GET` returns `[]` not 404 for unknown files** | Audit absence is not an error. Callers should not need to handle 404 to check if a file has been audited yet. |
| **`AuditTrailResponse` separate from `AuditEventResponse`** | Trail entries omit internal fields (`id`, `retry_count`, `payload`) that are not relevant to trail consumers; exposes `tx_hash` and `status` for blockchain transparency. |
| **Route commits session** | `audit_service.record()` only flushes. The route calls `db.commit()` after the service returns, maintaining clean separation of concerns. |

---

## Files Changed

| File | Changes |
|---|---|
| [`backend/app/api/routes/audit.py`](../backend/app/api/routes/audit.py) | Implemented `POST /audit/record` and `GET /audit/{file_id}`; added self-contained `get_db()` dependency |
| [`backend/app/schemas/audit.py`](../backend/app/schemas/audit.py) | Added `AuditTrailResponse`; preserved `AuditEventCreate` and `AuditEventResponse` with full backward compatibility |
| [`backend/tests/test_audit_api.py`](../backend/tests/test_audit_api.py) | 23 new HTTP-level tests using `FastAPI TestClient` + SQLite in-memory override |

---

## API Endpoints

### `POST /audit/record`

**Purpose:** Record a new audit event and queue it for blockchain submission.

**HTTP Method:** `POST`

**Request body:**
```json
{
    "event_type": "FILE_UPLOADED",
    "reference_id": "file123",
    "actor": "user123",
    "payload": {
        "hash": "abc123"
    }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `event_type` | string | ✅ | 1–64 chars |
| `reference_id` | string | ✅ | 1–255 chars |
| `actor` | string | ✅ | 1–255 chars |
| `payload` | object \| null | ❌ | Any JSON object |

**Response (HTTP 201):**
```json
{
    "id": "84c1a2a2-4494-49a7-95d1-c0bffa3b3b92",
    "event_type": "FILE_UPLOADED",
    "reference_id": "file123",
    "actor": "user123",
    "payload": { "hash": "abc123" },
    "status": "pending",
    "tx_hash": null,
    "created_at": "2026-09-28T17:44:21.852233Z"
}
```

**Validation errors:** HTTP 422 with Pydantic error detail.

---

### `GET /audit/{file_id}`

**Purpose:** Return the full chronological audit trail for a file.

**HTTP Method:** `GET`

**Path parameter:** `file_id` — the `reference_id` used when recording events.

**Response (HTTP 200):**
```json
[
    {
        "event_type": "FILE_UPLOADED",
        "reference_id": "file123",
        "actor": "user123",
        "status": "confirmed",
        "tx_hash": "0x1d578f77bdcbb3ce3d2ab345c6ce593b8c25bd46",
        "created_at": "2026-09-28T17:44:21.852233Z"
    },
    {
        "event_type": "FILE_APPROVED",
        "reference_id": "file123",
        "actor": "reviewer-1",
        "status": "pending",
        "tx_hash": null,
        "created_at": "2026-09-28T17:50:00.000000Z"
    }
]
```

Returns `[]` if no events have been recorded for the given `file_id`.

---

## Architecture Flow

```
User/API Request
        │
        ▼
POST /audit/record  OR  GET /audit/{file_id}
        │
        ▼
Pydantic validation  (AuditEventCreate)
        │
        ▼
audit_service.record()
        │
        ▼
outbox_service.create_event()
        │
        ▼
AuditOutbox DB row  (status = "pending")
        │
        ▼ [asynchronous — next worker run]
outbox_worker.process_pending_events()
        │
        ▼
ChainService  (FakeChainService / RealChainService)
        │
        ▼
MST EVM Blockchain  →  tx_hash  →  mark_confirmed()
```

---

## Testing

**Command:**
```bash
pytest tests/ -v
```

**Results:**

| Metric | Count |
|---|---|
| ✅ Passed | **83** |
| ❌ Failed | 0 |
| ⚠️ Warnings | 1 (pre-existing httpx deprecation) |

**New tests added (23) in `test_audit_api.py`:**

| Class | Tests |
|---|---|
| `TestPostAuditRecord` | 7 — 201 status, id/status/tx_hash fields, payload optional, created_at present |
| `TestPostAuditRecordValidation` | 6 — missing fields, empty strings, too-long event_type |
| `TestGetAuditTrail` | 10 — 200 status, list type, count, empty trail, required fields, ordering, file isolation, event_type correctness |

All tests use **SQLite in-memory** with `StaticPool` — no PostgreSQL, Docker, or network required.

---

## Git Information

**Commit:** `d9de8c7`

**Message:** `feat: add audit api routes`

**Branch:** `sriganesh`

**Files in commit:**
```
M  backend/app/api/routes/audit.py
M  backend/app/schemas/audit.py
A  backend/tests/test_audit_api.py
```

---

## Next Phase

**Phase 5 — Solidity Contract Implementation** (`contracts/*.sol`)

Implement the four contract stubs against MST EVM:

| Contract | Purpose |
|---|---|
| `Ownership.sol` | On-chain file ownership registry |
| `Permission.sol` | Access-control grant recording |
| `Integrity.sol` | Content hash anchoring per file version |
| `Audit.sol` | Append-only audit event log |

Supporting work:
- Update `contracts/hardhat.config.js` with MST EVM network config
- Add Hardhat deploy scripts in `contracts/scripts/`
- Add Hardhat tests in `contracts/tests/`
- Update `RealChainService` (`backend/app/chain/real.py`) to call the deployed contracts via `mst-sdk-python`
