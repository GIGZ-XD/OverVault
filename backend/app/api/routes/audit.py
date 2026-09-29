"""Audit trail queries and audit event recording."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.audit_outbox import AuditOutbox
from app.models.user import User
from app.schemas.audit import AuditEventCreate, AuditEventResponse, AuditFeedEvent, AuditTrailResponse
from app.services import audit as audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


def _status_to_verification(outbox_status: str) -> str:
    """Map AuditOutbox.status to the frontend Verification enum.

    Outbox lifecycle:  pending -> submitted -> confirmed | failed
    Frontend enum:     pending                | verified | tampered
    """
    if outbox_status == "confirmed":
        return "verified"
    if outbox_status == "failed":
        return "tampered"
    return "pending"  # pending or submitted


@router.get("", response_model=list[AuditFeedEvent])
def list_audit_events(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AuditFeedEvent]:
    """Global workspace audit feed consumed by the audit page (GET /audit).

    Returns all outbox events newest-first, mapping the internal outbox
    status to the frontend's Verification enum (verified/pending/tampered).
    reference_id is exposed as file_id since the audit table renders it as
    the resource the event belongs to.
    """
    stmt = select(AuditOutbox).order_by(AuditOutbox.created_at.desc())
    rows = list(db.scalars(stmt))
    return [
        AuditFeedEvent(
            id=row.id,
            event_type=row.event_type,
            file_id=row.reference_id,
            reference_id=row.reference_id,
            actor=row.actor,
            status=row.status,
            verification=_status_to_verification(row.status),
            tx_hash=row.tx_hash,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/record", response_model=AuditEventResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/{file_id}", response_model=list[AuditTrailResponse])
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
