"""Production Audit Event model.

Represents immutable structured audit events in the OverVault pipeline.

Required fields:
- event_id (UUID)
- event_type (FILE_UPLOADED, FILE_HASHED, OWNERSHIP_REGISTERED, PERMISSION_GRANTED, FILE_ACCESSED, FILE_SHARED, FILE_DELETED, etc.)
- file_id
- actor
- timestamp
- content_hash
- metadata (JSON payload)
- chain_status (pending, processing, submitted, confirmed, retry, failed, dead_letter)
- transaction_hash

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.audit_outbox import Base


class AuditEventType(StrEnum):
    """Supported audit event types in the OverVault pipeline."""

    FILE_UPLOADED = "FILE_UPLOADED"
    FILE_HASHED = "FILE_HASHED"
    OWNERSHIP_REGISTERED = "OWNERSHIP_REGISTERED"
    PERMISSION_GRANTED = "PERMISSION_GRANTED"
    FILE_ACCESSED = "FILE_ACCESSED"
    FILE_SHARED = "FILE_SHARED"
    FILE_DELETED = "FILE_DELETED"


class AuditEvent(Base):
    """Production audit event record capturing file operations and blockchain status."""

    __tablename__ = "audit_events"

    event_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Unique UUID for this audit event.",
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Type of event (e.g. FILE_UPLOADED, FILE_HASHED).",
    )
    file_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Target file or document identifier.",
    )
    actor: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="User ID, username, or wallet address that triggered the event.",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        doc="UTC timestamp when the event occurred.",
    )
    content_hash: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        doc="Cryptographic SHA-256 hash of file content if applicable.",
    )
    metadata_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        doc="JSON-encoded arbitrary metadata payload.",
    )
    chain_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
        doc="Blockchain lifecycle status: pending, processing, submitted, confirmed, retry, failed, dead_letter.",
    )
    transaction_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
        default=None,
        doc="On-chain EVM transaction hash.",
    )

    @property
    def event_metadata(self) -> dict[str, Any]:
        """Return parsed metadata dictionary from JSON string."""
        if not self.metadata_json:
            return {}
        try:
            val = json.loads(self.metadata_json)
            return val if isinstance(val, dict) else {}
        except (json.JSONDecodeError, ValueError):
            return {}

    @event_metadata.setter
    def event_metadata(self, val: dict[str, Any] | None) -> None:
        """Serialize metadata dict to JSON string."""
        if val is None:
            self.metadata_json = None
        else:
            self.metadata_json = json.dumps(val, default=str)

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to standard dictionary representation."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "file_id": self.file_id,
            "actor": self.actor,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "content_hash": self.content_hash,
            "metadata": self.event_metadata,
            "chain_status": self.chain_status,
            "transaction_hash": self.transaction_hash,
        }

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<AuditEvent event_id={self.event_id!r} event_type={self.event_type!r} "
            f"file_id={self.file_id!r} status={self.chain_status!r}>"
        )
