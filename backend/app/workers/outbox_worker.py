"""Reads audit_outbox and calls ChainService with retries. Chain writes happen only here."""
import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chain.fake import FakeChainService
from app.db import SessionLocal
from app.models.audit_outbox import AuditOutbox

logger = logging.getLogger("overvault.outbox_worker")


def run_once(db: Session | None = None, chain=None) -> int:
    """Processes pending audit outbox events and commits them on-chain."""
    from app.deps import get_chain_service
    from app.services import blockchain as blockchain_service

    own = db is None
    db = db or SessionLocal()
    chain = chain or get_chain_service()
    try:
        stmt = (
            select(AuditOutbox)
            .where(AuditOutbox.status == "pending")
            .order_by(AuditOutbox.created_at)
            .limit(50)
        )
        pending = list(db.scalars(stmt))
        for row in pending:
            try:
                # Log audit event to chain service
                tx = chain.log_audit(
                    event_type=row.event_type,
                    ref=row.reference_id,
                    actor=row.actor,
                )
                row.tx_hash = tx.tx_hash
                row.status = "confirmed"
                if tx.tx_hash:
                    blockchain_service.record_tx(
                        db,
                        tx_hash=tx.tx_hash,
                        contract_called="Audit",
                        action="log_audit",
                        reference_id=row.reference_id,
                        status=tx.status,
                    )
            except Exception as e:
                logger.warning("Failed to commit outbox row %s to chain: %s", row.id, e)
                # Keep as pending for retry

        db.commit()
        return len(pending)
    finally:
        if own:
            db.close()


async def run_forever(interval_seconds: int = 5) -> None:
    """Continuously poll audit_outbox and flush pending records."""
    while True:
        try:
            count = await asyncio.to_thread(run_once)
            if count:
                logger.info("Outbox worker confirmed %d events on chain", count)
        except Exception:
            logger.exception("Outbox worker loop encountered an error")
        await asyncio.sleep(interval_seconds)
