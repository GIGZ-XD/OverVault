"""Audit trail assembly."""
from typing import Any
from sqlalchemy.orm import Session


def record(
    db: Session,
    *,
    actor_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    content_hash: str | None = None,
    metadata: dict[str, Any] | None = None,
    signature: str | None = None,
) -> None:
    """Placeholder stub for recording audit events into the outbox."""
    pass
