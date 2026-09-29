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
from app.models.file import File
from app.models.user import User
from app.schemas.audit import AuditEventCreate, AuditEventResponse, AuditTrailResponse
from app.services import audit as audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


def _build_trail_response(row: AuditOutbox, files_map: dict[str, str], users_map: dict[str, str]) -> AuditTrailResponse:
    fname = files_map.get(row.reference_id)
    aname = users_map.get(row.actor, row.actor)
    dtl = None
    if isinstance(row.payload, dict):
        dtl = row.payload.get("detail") or row.payload.get("comment") or row.payload.get("action")
    return AuditTrailResponse(
        id=row.id,
        event_type=row.event_type,
        reference_id=row.reference_id,
        file_id=row.reference_id,
        file_name=fname,
        actor=row.actor,
        actor_name=aname,
        status=row.status,
        verification="verified" if row.status == "confirmed" else "pending",
        tx_hash=row.tx_hash,
        created_at=row.created_at,
        timestamp=row.created_at.timestamp(),
        detail=dtl,
    )


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
    files_map = {f.id: f.name for f in db.query(File).all()}
    users_map = {u.id: u.name for u in db.query(User).all()}
    stmt = select(AuditOutbox).order_by(AuditOutbox.created_at.desc())
    rows = list(db.scalars(stmt))
    return [_build_trail_response(row, files_map, users_map) for row in rows]


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
    files_map = {f.id: f.name for f in db.query(File).all()}
    users_map = {u.id: u.name for u in db.query(User).all()}
    stmt = (
        select(AuditOutbox)
        .where(AuditOutbox.reference_id == file_id)
        .order_by(AuditOutbox.created_at)
    )
    rows = list(db.scalars(stmt))
    return [_build_trail_response(row, files_map, users_map) for row in rows]
