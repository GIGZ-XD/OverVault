"""Audit trail assembly service.

Owner: Sriganesh (Blockchain & Audit Engineer). This service does NOT call
ChainService - blockchain submission is the outbox worker's job, async,
after the outbox row is committed.

    Application action -> audit.record() -> audit_outbox row (pending)
                                                  -> outbox_worker -> ChainService

RECONCILIATION NOTE (flag back to Sriganesh, see ADR 0006):
ADR 0003 (agreed before this file existed) assumed record() would take
actor_id/action/resource_type/resource_id/content_hash/metadata. The delivered
implementation uses event_type/reference_id/actor/payload instead, and every
one of Vineeth's 11 call sites across versioning.py, permissions.py,
protection.py, approvals.py and expiry_job.py already calls the ADR 0003
shape. Rather than touch all 11 call sites (and risk drifting from what he
tests against on his end), record_event() below is his delivered function
UNCHANGED, and record() is a thin adapter translating the old shape onto it:
  * actor_id=None (expiry_job's system-triggered events) -> actor="system",
    since AuditOutbox.actor is NOT NULL.
  * action -> event_type.
  * reference_id is the FILE the event is about, not the narrower
    sub-resource: resource_type=="file" -> resource_id directly; otherwise
    metadata["file_id"] if present, else resource_id. Every call site already
    puts file_id in metadata for non-file resources (versions, permissions,
    approvals), so GET /audit/{file_id} returns every event for that file.
  * resource_type/resource_id/content_hash are folded into payload alongside
    the caller's own metadata, so nothing is lost - just re-homed.
If Sriganesh would rather change record_event()'s signature to match ADR 0003
directly, this adapter can be deleted and the 11 call sites left as they are.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.schemas.audit import AuditEventResponse
from app.services import outbox as outbox_service


def record_event(
    db: Session,
    *,
    event_type: str,
    reference_id: str,
    actor: str,
    payload: dict[str, Any] | None = None,
) -> AuditEventResponse:
    """Sriganesh's delivered record() function, renamed record_event() here
    only so record() below can be the adapter. Behaviour is unchanged: creates
    a pending AuditOutbox row via outbox.create_event() and does NOT commit -
    the caller commits once, after this call, per ADR 0003."""
    event = outbox_service.create_event(
        db, event_type=event_type, reference_id=reference_id, actor=actor, payload=payload
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


def record(
    db: Session,
    *,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str,
    content_hash: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEventResponse:
    """Adapter matching ADR 0003 / every existing call site. See the module
    docstring for the exact translation rules."""
    metadata = metadata or {}
    reference_id = resource_id if resource_type == "file" else metadata.get("file_id", resource_id)
    payload: dict[str, Any] = {**metadata, "resource_type": resource_type, "resource_id": resource_id}
    if content_hash is not None:
        payload["content_hash"] = content_hash
    return record_event(
        db,
        event_type=action,
        reference_id=reference_id,
        actor=actor_id or "system",
        payload=payload,
    )
