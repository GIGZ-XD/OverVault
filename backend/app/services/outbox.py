"""Outbox CRUD helpers for the audit outbox pipeline.

All functions operate on a SQLAlchemy Session and return AuditOutbox
instances directly so that callers (audit service, outbox worker) stay
decoupled from raw SQL.

Function responsibilities:

- ``create_event``      — insert a new pending outbox row
- ``get_pending_events`` — query rows awaiting blockchain submission
- ``mark_submitted``    — record that the worker sent a tx to the chain
- ``mark_confirmed``    — record that the chain confirmed the tx
- ``mark_failed``       — record a failed submission and increment retry_count

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_outbox import AuditOutbox

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_RETRIES: int = 5
"""Maximum number of submission attempts before an event is considered permanently failed."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    """Return the current UTC datetime (extracted for easy test patching)."""
    return datetime.now(timezone.utc)


def _encode_payload(payload: dict[str, Any] | None) -> str | None:
    """Serialise an arbitrary dict to a JSON string, or return None."""
    if payload is None:
        return None
    return json.dumps(payload, default=str)


# ---------------------------------------------------------------------------
# CRUD functions
# ---------------------------------------------------------------------------


def create_event(
    db: Session,
    *,
    event_type: str,
    reference_id: str,
    actor: str,
    payload: dict[str, Any] | None = None,
) -> AuditOutbox:
    """Create and persist a new pending audit outbox event.

    The event starts in the ``pending`` state and will be picked up by the
    outbox worker for blockchain submission on its next run.

    Args:
        db:           Active SQLAlchemy session.
        event_type:   Semantic event label (e.g. ``"upload"``, ``"approve"``).
        reference_id: Subject identifier (e.g. file_id, version key).
        actor:        User ID or wallet address that triggered the event.
        payload:      Optional extra context dict — serialised to JSON.

    Returns:
        The newly created and persisted ``AuditOutbox`` instance.
    """
    event = AuditOutbox(
        event_type=event_type,
        reference_id=reference_id,
        actor=actor,
        payload=_encode_payload(payload),
        status="pending",
        retry_count=0,
        tx_hash=None,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(event)
    db.flush()  # assign id without committing — caller controls the transaction
    return event


def get_pending_events(
    db: Session,
    *,
    limit: int = 100,
) -> list[AuditOutbox]:
    """Return outbox rows that are waiting for blockchain submission.

    Only rows with ``status="pending"`` and ``retry_count < MAX_RETRIES``
    are returned, ordered oldest-first so events are processed in order.

    Args:
        db:    Active SQLAlchemy session.
        limit: Maximum number of rows to return per batch (default 100).

    Returns:
        Ordered list of ``AuditOutbox`` instances ready to be submitted.
    """
    stmt = (
        select(AuditOutbox)
        .where(
            AuditOutbox.status == "pending",
            AuditOutbox.retry_count < MAX_RETRIES,
        )
        .order_by(AuditOutbox.created_at)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def mark_submitted(
    db: Session,
    event: AuditOutbox,
    *,
    tx_hash: str,
) -> AuditOutbox:
    """Transition an event to ``submitted`` after sending to the chain.

    Called by the outbox worker immediately after calling ``ChainService``.
    The ``tx_hash`` from the chain is stored so it can later be confirmed.

    Args:
        db:      Active SQLAlchemy session.
        event:   The outbox row being updated.
        tx_hash: Transaction hash returned by the ChainService call.

    Returns:
        The updated ``AuditOutbox`` instance.
    """
    event.status = "submitted"
    event.tx_hash = tx_hash
    event.updated_at = _now()
    db.flush()
    return event


def mark_confirmed(
    db: Session,
    event: AuditOutbox,
) -> AuditOutbox:
    """Transition an event to ``confirmed`` after chain confirmation.

    Called by the outbox worker when ``ChainService.verify_transaction()``
    returns ``True`` for the stored ``tx_hash``.

    Args:
        db:    Active SQLAlchemy session.
        event: The outbox row being updated.

    Returns:
        The updated ``AuditOutbox`` instance.
    """
    event.status = "confirmed"
    event.updated_at = _now()
    db.flush()
    return event


def mark_failed(
    db: Session,
    event: AuditOutbox,
) -> AuditOutbox:
    """Record a failed submission attempt and increment the retry counter.

    If ``retry_count`` reaches ``MAX_RETRIES`` the status transitions to
    ``"failed"`` (permanently), otherwise it stays ``"pending"`` so the
    worker will retry on the next run.

    Args:
        db:    Active SQLAlchemy session.
        event: The outbox row being updated.

    Returns:
        The updated ``AuditOutbox`` instance.
    """
    event.retry_count += 1
    event.updated_at = _now()
    if event.retry_count >= MAX_RETRIES:
        event.status = "failed"
    # else: stays "pending" — will be picked up again by get_pending_events()
    db.flush()
    return event
