"""Pydantic schemas for audit events and audit trail responses."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=64)
    reference_id: str = Field(..., min_length=1, max_length=255)
    actor: str = Field(..., min_length=1, max_length=255)
    payload: dict[str, Any] | None = None


class AuditEventResponse(BaseModel):
    id: str
    event_type: str
    reference_id: str
    actor: str
    payload: dict[str, Any] | None = None
    status: str
    tx_hash: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditFeedEvent(BaseModel):
    """Shape returned by GET /audit — the global workspace audit feed.

    Matches the frontend AuditEvent interface in lib/api/types.ts.
    - file_id / reference_id: the file the event belongs to.
    - verification: mapped from outbox status (confirmed→verified,
      pending/submitted→pending, failed→tampered).
    """
    id: str
    event_type: str
    file_id: str | None = None
    reference_id: str | None = None
    actor: str
    status: str
    verification: str  # "verified" | "pending" | "tampered"
    tx_hash: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditTrailResponse(BaseModel):
    event_type: str
    reference_id: str
    actor: str
    status: str
    tx_hash: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
