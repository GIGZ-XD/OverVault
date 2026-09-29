"""Audit trail queries.

- ``POST /audit/record``     — record a new audit event (stored in AuditOutbox)
- ``GET  /audit/{file_id}``  — return the chronological audit trail for a file

Neither endpoint touches ChainService directly - that's the outbox worker's job.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
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
    "",
    response_model=list[AuditTrailResponse],
    summary="List all audit trail events across the vault",
)
def list_all_audit(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditTrailResponse]:
    stmt = select(AuditOutbox).order_by(AuditOutbox.created_at.desc())
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
