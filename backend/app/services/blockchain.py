"""Blockchain tracking service. Records transaction hashes, contracts, actions, and statuses."""
from __future__ import annotations

import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.blockchain_transaction import BlockchainTransaction

logger = logging.getLogger("overvault.blockchain")


def record_tx(
    db: Session,
    *,
    tx_hash: str,
    contract_called: str,
    action: str,
    reference_id: str | None = None,
    status: str = "confirmed",
    block_number: int | None = None,
) -> BlockchainTransaction:
    """Record an on-chain transaction into the blockchain_transactions table."""
    existing = db.scalar(
        select(BlockchainTransaction).where(BlockchainTransaction.tx_hash == tx_hash)
    )
    if existing:
        existing.status = status
        if block_number:
            existing.block_number = block_number
        db.flush()
        return existing

    record = BlockchainTransaction(
        tx_hash=tx_hash,
        contract_called=contract_called,
        action=action,
        reference_id=reference_id,
        status=status,
        block_number=block_number,
    )
    db.add(record)
    db.flush()
    return record


def get_latest_tx_for_ref(db: Session, reference_id: str) -> str | None:
    """Return the most recent confirmed transaction hash for a reference ID."""
    return db.scalar(
        select(BlockchainTransaction.tx_hash)
        .where(
            BlockchainTransaction.reference_id == reference_id,
            BlockchainTransaction.status == "confirmed",
        )
        .order_by(BlockchainTransaction.created_at.desc())
    )
