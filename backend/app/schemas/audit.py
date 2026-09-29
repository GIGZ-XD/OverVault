"""Pydantic schemas for audit. Must match specs/openapi.yaml.

Provides request/response schemas for the audit outbox pipeline.

- ``AuditEventCreate``    — validates incoming audit event data.
- ``AuditEventResponse``  — serialises outbox rows for API responses and
                            internal service returns.
- ``AuditTrailResponse``  — a single entry in a file's chronological audit trail.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=64)
    reference_id: str = Field(..., min_length=1, max_length=255)
    actor: str = Field(..., min_length=1, max_length=255)
    payload: dict[str, Any] | None = Field(default=None)


class AuditEventResponse(BaseModel):
    id: str
    event_type: str
    reference_id: str
    actor: str
    payload: dict[str, Any] | None = Field(default=None)
    status: str
    tx_hash: str | None = Field(default=None)
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditTrailResponse(BaseModel):
    event_type: str
    reference_id: str
    actor: str
    status: str
    tx_hash: str | None = Field(default=None)
    created_at: datetime

    model_config = {"from_attributes": True}
