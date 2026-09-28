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

# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------


class AuditEventCreate(BaseModel):
    """Schema for creating an audit event.

    Used by API routes and internal services to validate the data needed
    to record a new audit event in the outbox.
    """

    event_type: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Semantic event label, e.g. 'upload', 'approve', 'grant_permission'.",
        examples=["FILE_UPLOADED"],
    )
    reference_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Subject identifier the event relates to (e.g. file_id, version key).",
        examples=["file-abc123"],
    )
    actor: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="User ID or wallet address that triggered the event.",
        examples=["user-001"],
    )
    payload: dict[str, Any] | None = Field(
        default=None,
        description="Optional extra context. Stored as JSON in the database.",
        examples=[{"hash": "abc123", "size_bytes": 204800}],
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AuditEventResponse(BaseModel):
    """Schema returned after recording an audit event.

    Represents a single ``AuditOutbox`` row as seen by the API caller or
    internal service consumer.  The ``tx_hash`` field is ``None`` until the
    outbox worker submits the event to the blockchain.
    """

    id: str = Field(..., description="UUID of the outbox row.")
    event_type: str = Field(..., description="Semantic event label.")
    reference_id: str = Field(..., description="Subject identifier.")
    actor: str = Field(..., description="User or wallet that triggered the event.")
    payload: dict[str, Any] | None = Field(
        default=None,
        description="Extra context dict as originally provided (None if absent).",
    )
    status: str = Field(
        ...,
        description="Current lifecycle state: pending | submitted | confirmed | failed.",
    )
    tx_hash: str | None = Field(
        default=None,
        description="On-chain transaction hash. None until submitted to blockchain.",
    )
    created_at: datetime = Field(..., description="UTC timestamp when the event was recorded.")

    model_config = {"from_attributes": True}


class AuditTrailResponse(BaseModel):
    """A single entry in a file's chronological audit trail.

    Returned by ``GET /audit/{file_id}`` as a list element.
    Omits internal fields (``id``, ``retry_count``) that are not relevant
    to API consumers; exposes ``tx_hash`` and ``status`` for blockchain
    transparency.
    """

    event_type: str = Field(..., description="Semantic event label.")
    reference_id: str = Field(..., description="Subject identifier.")
    actor: str = Field(..., description="User or wallet that triggered the event.")
    status: str = Field(
        ...,
        description="Current lifecycle state: pending | submitted | confirmed | failed.",
    )
    tx_hash: str | None = Field(
        default=None,
        description="On-chain transaction hash if the event has been submitted.",
    )
    created_at: datetime = Field(..., description="UTC timestamp when the event was recorded.")

    model_config = {"from_attributes": True}
