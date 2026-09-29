"""Outbox rows for async chain writes.

AuditOutbox stores every audit event immediately in the database.
The outbox_worker later picks up pending rows and submits them to the
ChainService (MST EVM in production, FakeChainService in dev/test).

This decoupling means:
- Application actions never block on blockchain latency.
- Failed chain submissions are retried without data loss.
- The audit trail is always persisted, even if the chain is unavailable.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# ---------------------------------------------------------------------------
# Status type
# ---------------------------------------------------------------------------

OutboxStatus = Literal[
    "pending", "processing", "submitted", "confirmed", "retry", "failed", "dead_letter"
]

# ---------------------------------------------------------------------------
# Declarative base (used by all audit-layer models)
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for the audit outbox model."""


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


class AuditOutbox(Base):
    """Database table that acts as the transactional outbox for blockchain writes.

    Lifecycle of a row::

        pending → processing → submitted → confirmed
                 ↘ retry     → dead_letter (or failed)

    Columns:
        id:           UUID primary key (string form for cross-DB compatibility).
        event_type:   Semantic label, e.g. ``"upload"``, ``"approve"``, ``"grant_permission"``.
        reference_id: Subject of the event (file_id, version key, …).
        actor:        User ID or wallet address that triggered the event.
        payload:      JSON blob with any additional context (stored as text).
        status:       Current lifecycle state (see OutboxStatus).
        retry_count:  Number of failed submission attempts so far.
        last_error:   Description of the most recent failure error.
        tx_hash:      Chain transaction hash — populated after successful submission.
        processed_at: UTC timestamp when the row was processed or finalized.
        created_at:   UTC timestamp when the row was inserted.
        updated_at:   UTC timestamp of the last status change.
    """

    __tablename__ = "audit_outbox"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="UUID primary key.",
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Semantic event label.",
    )
    reference_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Subject identifier (file_id, version key, …).",
    )
    actor: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="User ID or wallet address that triggered the event.",
    )
    payload: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        doc="JSON-encoded additional context. May be NULL for events with no extra data.",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
        doc="Lifecycle state: pending | processing | submitted | confirmed | retry | failed | dead_letter.",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Number of failed submission attempts. Reset to 0 after a successful submit.",
    )
    last_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        doc="Error message or exception context from the last failed attempt.",
    )
    tx_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
        default=None,
        doc="On-chain transaction hash. Populated by the outbox worker after submission.",
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        doc="UTC timestamp when the row was processed or confirmed.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        doc="UTC timestamp when the outbox row was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        doc="UTC timestamp of the last status transition.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<AuditOutbox id={self.id!r} event_type={self.event_type!r} "
            f"status={self.status!r}>"
        )
