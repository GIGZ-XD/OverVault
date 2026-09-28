"""Audit trail queries.

- ``POST /audit/record``     — record a new audit event (stored in AuditOutbox)
- ``GET  /audit/{file_id}``  — return the chronological audit trail for a file

Neither endpoint touches ChainService directly - that's the outbox worker's job.

Owner: Sriganesh (Blockchain & Audit Engineer).

FIXES (flag back to Sriganesh):
  1. `from app.config import settings` doesn't exist - Vineeth's config.py only
     exports get_settings() (no module-level `settings`). This was an
     immediate ImportError, so app.api.router's `try/except ImportError` around
     including this route was silently swallowing it and the endpoints never
     actually mounted.
  2. get_db() opened its OWN sqlalchemy engine/Session instead of using
     app.db.get_db. Two engines against the same app means audit writes made
     through this route would not share a transaction/connection with the rest
     of the app - exactly what ADR 0003 says NOT to do. Your own comment
     already said to swap this once db.py existed; it now does, so swapped.
Both fixed below by importing app.db.get_db, per your own comment.

ALSO ADDED (please confirm, not a silent decision): a get_current_user
dependency. Every other route in the app requires a JWT; these two didn't,
so anyone could POST arbitrary audit events or read any file's trail
unauthenticated. If that's intentional (e.g. audit.record should only ever be
called server-side, not over HTTP), say so and this can be reverted.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db  # was a locally-opened engine - see FIX note above
from app.deps import get_current_user  # ADDED - see note above
from app.models.audit_outbox import AuditOutbox
from app.models.user import User
from app.schemas.audit import AuditEventCreate, AuditEventResponse, AuditTrailResponse
from app.services import audit as audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.post(
    "/record",
    response_model=AuditEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an audit event",
)
def record_audit_event(
    body: AuditEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AuditEventResponse:
    response = audit_service.record_event(
        db,
        event_type=body.event_type,
        reference_id=body.reference_id,
        actor=body.actor,
        payload=body.payload,
    )
    db.commit()
    return response


@router.get(
    "/{file_id}",
    response_model=list[AuditTrailResponse],
    summary="Get audit trail for a file",
)
def get_audit_trail(
    file_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditTrailResponse]:
    stmt = (
        select(AuditOutbox)
        .where(AuditOutbox.reference_id == file_id)
        .order_by(AuditOutbox.created_at)
    )
    rows = list(db.scalars(stmt))
    return [
        AuditTrailResponse(
            event_type=row.event_type,
            reference_id=row.reference_id,
            actor=row.actor,
            status=row.status,
            tx_hash=row.tx_hash,
            created_at=row.created_at,
        )
        for row in rows
    ]
