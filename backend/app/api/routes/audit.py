"""Audit trail queries.

Exposes the audit pipeline through two HTTP endpoints:

- ``POST /audit/record``     — record a new audit event (stored in AuditOutbox)
- ``GET  /audit/{file_id}``  — return the chronological audit trail for a file

Neither endpoint touches ChainService directly.  Blockchain submission is
handled asynchronously by the outbox worker.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.audit_outbox import AuditOutbox
from app.schemas.audit import (
    AuditEventCreate,
    AuditEventResponse,
    AuditTrailResponse,
    AuditVerifyResponse,
)
from app.services import audit as audit_service

router = APIRouter(prefix="/audit", tags=["audit"])

# ---------------------------------------------------------------------------
# Database dependency
# ---------------------------------------------------------------------------
#
# db.py (owned by Vineeth) is not yet implemented.  We define a self-contained
# get_db() here so the audit routes are independently testable.  When db.py
# is ready, replace this with an import from app.deps.
#
# Tests override this dependency via app.dependency_overrides[get_db].

_engine = create_engine(
    settings.database_url.replace("+psycopg", "+psycopg2")
    if "+psycopg" in settings.database_url
    else settings.database_url,
    echo=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session, closing it after the request."""
    with Session(_engine) as db:
        yield db


DbDep = Annotated[Session, Depends(get_db)]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/record",
    response_model=AuditEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an audit event",
    description=(
        "Creates a new audit event and stores it in the AuditOutbox with "
        "``status=pending``. The outbox worker will submit it to the blockchain "
        "asynchronously. Returns the created event including its UUID and status."
    ),
)
def record_audit_event(
    body: AuditEventCreate,
    db: DbDep,
) -> AuditEventResponse:
    """POST /audit/record

    Validates the request body, calls ``audit_service.record()``, commits the
    session, and returns the created ``AuditEventResponse``.

    Args:
        body: Validated ``AuditEventCreate`` payload from the request body.
        db:   Injected SQLAlchemy session.

    Returns:
        ``AuditEventResponse`` with ``status="pending"`` and ``tx_hash=None``.
    """
    response = audit_service.record(
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
    description=(
        "Returns the complete chronological audit trail for the given ``file_id``. "
        "Each entry includes the event type, actor, current blockchain status, "
        "and ``tx_hash`` if the event has been submitted to the chain."
    ),
)
def get_audit_trail(
    file_id: str,
    db: DbDep,
) -> list[AuditTrailResponse]:
    """GET /audit/{file_id}

    Queries ``AuditOutbox`` rows matching the given ``reference_id``, ordered
    oldest-first.  Returns an empty list (not 404) when no events exist for
    the file — absence of audit events is valid and not an error.

    Args:
        file_id: The file identifier to retrieve the audit trail for.
        db:      Injected SQLAlchemy session.

    Returns:
        Ordered list of ``AuditTrailResponse`` entries, oldest first.
        Returns an empty list ``[]`` if no events have been recorded.
    """
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


@router.get(
    "/{file_id}/verify",
    response_model=AuditVerifyResponse,
    summary="Verify audit integrity and ownership for a file",
    description=(
        "Returns the on-chain audit and integrity verification summary for the given ``file_id``, "
        "including total audit event count and latest transaction reference."
    ),
)
def verify_file_audit(
    file_id: str,
    db: DbDep,
) -> AuditVerifyResponse:
    """GET /audit/{file_id}/verify

    Checks the audit outbox for events corresponding to the file and provides
    cryptographic verification status.
    """
    stmt = (
        select(AuditOutbox)
        .where(AuditOutbox.reference_id == file_id)
        .order_by(AuditOutbox.created_at.desc())
    )
    rows = list(db.scalars(stmt))

    if not rows:
        return AuditVerifyResponse(
            file_id=file_id,
            integrity="unverified",
            ownership="unverified",
            audit_events=0,
            latest_transaction=None,
        )

    confirmed_rows = [r for r in rows if r.status == "confirmed"]
    latest_tx = next((r.tx_hash for r in rows if r.tx_hash), None)

    if confirmed_rows:
        integrity_status = "verified"
        ownership_status = "verified"
    else:
        integrity_status = "pending"
        ownership_status = "pending"

    return AuditVerifyResponse(
        file_id=file_id,
        integrity=integrity_status,
        ownership=ownership_status,
        audit_events=len(rows),
        latest_transaction=latest_tx,
    )
