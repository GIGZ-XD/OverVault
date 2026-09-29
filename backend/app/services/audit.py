"""Audit trail assembly service.

Provides a single ``record()`` function that application code calls to log
any significant event.  Events are persisted to the ``audit_outbox`` table
immediately and returned to the caller as a schema object.

IMPORTANT: This service does NOT call ChainService.
Blockchain submission is the sole responsibility of the outbox worker
(``app.workers.outbox_worker``), which runs asynchronously and picks up
pending outbox rows after they are committed to the database.

Separation of concerns::

    Application action
          │
          ▼
    audit.record()          ← you are here
          │
          ▼
    audit_outbox DB row     (status=pending)
          │
          ▼
    outbox_worker           (future phase — async)
          │
          ▼
    ChainService / MST EVM

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.schemas.audit import AuditEventResponse
from app.services import outbox as outbox_service


def record(
    db: Session,
    *,
    event_type: str,
    reference_id: str,
    actor: str,
    payload: dict[str, Any] | None = None,
) -> AuditEventResponse:
    """Record an audit event and queue it for blockchain submission.

    Creates a new ``AuditOutbox`` row with ``status="pending"`` and returns
    an ``AuditEventResponse`` describing what was recorded.  The caller is
    responsible for committing the session; this function only flushes.

    Usage example::

        from app.services import audit as audit_service

        response = audit_service.record(
            db,
            event_type="upload",
            reference_id=str(file.id),
            actor=current_user.id,
            payload={"filename": file.name, "size_bytes": file.size},
        )

    Args:
        db:           Active SQLAlchemy session (injected by FastAPI dependency).
        event_type:   Semantic label for the event (e.g. ``"upload"``,
                      ``"approve"``, ``"grant_permission"``).
        reference_id: Subject identifier the event relates to
                      (typically a file_id or version key).
        actor:        User ID or wallet address that triggered the event.
        payload:      Optional dict with any extra context about the event.
                      Will be JSON-serialised before storage.

    Returns:
        ``AuditEventResponse`` Pydantic schema populated from the created row.

    Note:
        This function does NOT commit the database session.  Wrap the call in
        a ``with session.begin()`` block or use FastAPI's dependency-injected
        session with auto-commit.
    """
    event = outbox_service.create_event(
        db,
        event_type=event_type,
        reference_id=reference_id,
        actor=actor,
        payload=payload,
    )

    return AuditEventResponse(
        id=event.id,
        event_type=event.event_type,
        reference_id=event.reference_id,
        actor=event.actor,
        payload=payload,
        status=event.status,
        tx_hash=event.tx_hash,
        created_at=event.created_at,
    )
