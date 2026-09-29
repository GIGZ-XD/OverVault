from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class BlockchainTransaction(Base):
    """Tracks all transactions sent to the MST Testnet blockchain."""

    __tablename__ = "blockchain_transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tx_hash: Mapped[str] = mapped_column(String(66), unique=True, index=True)
    contract_called: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="confirmed", index=True)
    block_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __repr__(self) -> str:
        return f"<BlockchainTransaction tx_hash={self.tx_hash!r} contract={self.contract_called!r} status={self.status!r}>"
