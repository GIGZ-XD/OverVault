"""Marks expired permission grants as revoked (reason='expired') and audits each one.
Access checks already ignore expired grants; this job makes expiry visible/auditable."""
import asyncio
import logging

from sqlalchemy import select

from app.db import SessionLocal
from app.models.base import utcnow
from app.models.permission import Permission
from app.services import audit

logger = logging.getLogger("overvault.expiry")


def run_once(db=None) -> int:
    own = db is None
    db = db or SessionLocal()
    try:
        now = utcnow()
        expired = db.scalars(
            select(Permission).where(
                Permission.revoked_at.is_(None), Permission.expires_at.is_not(None), Permission.expires_at <= now
            )
        ).all()
        for p in expired:
            p.revoked_at, p.revoked_reason = now, "expired"
            audit.record(
                db,
                actor_id=None,
                action="permission.expired",
                resource_type="permission",
                resource_id=p.id,
                metadata={"file_id": p.file_id, "grantee_id": p.user_id},
            )
        db.commit()
        return len(expired)
    finally:
        if own:
            db.close()


async def run_forever(interval_seconds: int) -> None:
    while True:
        try:
            count = await asyncio.to_thread(run_once)
            if count:
                logger.info("expired %d grants", count)
        except Exception:  # never let the loop die
            logger.exception("expiry job failed")
        await asyncio.sleep(interval_seconds)
