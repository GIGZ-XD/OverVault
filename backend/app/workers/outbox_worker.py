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
    own = db is None
    db = db or SessionLocal()
    chain = chain or FakeChainService()
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
