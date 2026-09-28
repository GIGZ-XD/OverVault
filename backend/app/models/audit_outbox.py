"""Outbox rows for async chain writes.

AuditOutbox stores every audit event immediately in the database.
The outbox_worker later picks up pending rows and submits them to the
ChainService (MST EVM in production, FakeChainService in dev/test).

Owner: Sriganesh (Blockchain & Audit Engineer).

FIX (flag back to Sriganesh): the delivered version of this file declared its
own `class Base(DeclarativeBase)`. That put AuditOutbox on a SEPARATE
SQLAlchemy metadata from every other model, so `Base.metadata.create_all()` in
main.py and Alembic's autogenerate (migrations/env.py) would silently never
see this table - it would just never get created. Fixed by importing the
shared `Base` from app.models.base, same as every other model in the app.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base  # was a locally-declared Base - see FIX note above

OutboxStatus = Literal["pending", "submitted", "confirmed", "failed"]


class AuditOutbox(Base):
    """Transactional outbox for blockchain writes.

    Lifecycle: pending -> submitted -> confirmed (or -> failed, retried up to
    max_retries).
    """

    __tablename__ = "audit_outbox"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), doc="UUID primary key."
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reference_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", index=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuditOutbox id={self.id!r} event_type={self.event_type!r} status={self.status!r}>"
