"""TEMPORARY STAND-IN - owned by Sriganesh, not yet delivered.

app/services/audit.py (his file) imports `outbox_service.create_event(...)`,
but outbox.py itself was never sent over. Without SOME version of this
function, `audit.record()` raises ImportError and every mutation in the app
fails (every service calls audit.record()).

This stub does the minimum: builds an AuditOutbox row, adds it to the session
(does NOT commit - same rule as audit.record()) and returns it. It does not
touch ChainService, batching, or retries - that's the real implementation's
job. REPLACE this whole file with Sriganesh's real outbox.py; nothing else
needs to change when you do, since his audit.py already imports it by this
same name and calls it the same way.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_outbox import AuditOutbox


def create_event(
    db: Session,
    *,
    event_type: str,
    reference_id: str,
    actor: str,
    payload: dict[str, Any] | None = None,
) -> AuditOutbox:
    row = AuditOutbox(
        event_type=event_type,
        reference_id=reference_id,
        actor=actor,
        payload=json.dumps(payload) if payload is not None else None,
        status="pending",
    )
    db.add(row)
    db.flush()
    return row
