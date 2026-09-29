"""Reads audit_outbox and calls ChainService with retries. Chain writes happen only here.

The outbox worker is the ONLY place in the backend that calls ChainService.
All other code records events via ``audit.record()`` and leaves blockchain
submission to this module.

Two public functions:

- ``process_single_event(db, chain, event)``
  Processes one outbox row end-to-end: calls the appropriate ChainService
  method, marks the row submitted, verifies the tx, then marks confirmed or
  failed.  Designed to be called by tests directly.

- ``process_pending_events(db, chain)``
  Fetches all pending rows via ``outbox_service.get_pending_events()`` and
  calls ``process_single_event()`` for each, committing after every event so
  a single chain failure doesn't roll back the whole batch.

Event-type routing:

  event_type containing "hash" or "integrity"   â†’ ChainService.commit_hash()
  event_type containing "ownership"              â†’ ChainService.register_ownership()
  event_type containing "permission"             â†’ ChainService.record_permission()
  all other event_types                          â†’ ChainService.log_audit()

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.chain.base import ChainService, TxResult
from app.models.audit_outbox import AuditOutbox
from app.services import outbox as outbox_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Event-type routing keywords
# ---------------------------------------------------------------------------

_HASH_KEYWORDS = frozenset({"hash", "integrity"})
_OWNERSHIP_KEYWORDS = frozenset({"ownership"})
_PERMISSION_KEYWORDS = frozenset({"permission"})

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class UnknownEventTypeError(ValueError):
    """Raised when an event_type cannot be routed to any ChainService method.

    The event is marked failed when this exception is caught by the worker,
    but it is intentionally NOT retried because the problem is in the data,
    not the chain.
    """


# ---------------------------------------------------------------------------
# Payload helpers
# ---------------------------------------------------------------------------


def _parse_payload(raw: str | None) -> dict[str, Any]:
    """Deserialise the stored JSON payload string, returning an empty dict if absent."""
    if not raw:
        return {}
    try:
        result = json.loads(raw)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, ValueError):
        return {}


def _classify(event_type: str) -> str:
    """Classify an event_type string into a chain-method category.

    Returns one of: ``"hash"``, ``"ownership"``, ``"permission"``, ``"audit"``.

    Matching is case-insensitive and checks whether any routing keyword is a
    substring of the event_type.
    """
    lower = event_type.lower()
    for kw in _HASH_KEYWORDS:
        if kw in lower:
            return "hash"
    for kw in _OWNERSHIP_KEYWORDS:
        if kw in lower:
            return "ownership"
    for kw in _PERMISSION_KEYWORDS:
        if kw in lower:
            return "permission"
    return "audit"


# ---------------------------------------------------------------------------
# Core: route a single event to the correct ChainService call
# ---------------------------------------------------------------------------


def _call_chain(
    chain: ChainService,
    event: AuditOutbox,
    payload: dict[str, Any],
) -> TxResult:
    """Route the event to the appropriate ChainService method and return the TxResult.

    Args:
        chain:   Any ChainService implementation (FakeChainService or RealChainService).
        event:   The outbox row being processed.
        payload: Deserialised payload dict from the outbox row.

    Returns:
        TxResult from the ChainService call.

    Raises:
        UnknownEventTypeError: If the event_type cannot be routed after classification
            falls through to ``"audit"`` but the event_type is explicitly unrecognised.
            (Currently all event_types route to ``log_audit`` as the default catch-all,
            so this error is only raised programmatically in tests or future guards.)
    """
    category = _classify(event.event_type)

    if category == "hash":
        # Payload must contain: file_id, version, content_hash
        # Falls back to reference_id / safe defaults so the worker never hard-crashes.
        return chain.commit_hash(
            file_id=payload.get("file_id", event.reference_id),
            version=int(payload.get("version", 1)),
            content_hash=payload.get("content_hash", ""),
        )

    if category == "ownership":
        # Payload must contain: owner_address, content_hash
        return chain.register_ownership(
            file_id=payload.get("file_id", event.reference_id),
            owner_address=payload.get("owner_address", event.actor),
            content_hash=payload.get("content_hash", ""),
        )

    if category == "permission":
        # Payload must contain: grantee, action; optionally expiry
        return chain.record_permission(
            file_id=payload.get("file_id", event.reference_id),
            grantee=payload.get("grantee", event.actor),
            action=payload.get("action", "read"),
            expiry=payload.get("expiry"),
        )

    # Default: generic audit event (upload, download, approve, delete, â€¦)
    return chain.log_audit(
        event_type=event.event_type,
        ref=payload.get("ref", event.reference_id),
        actor=event.actor,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def process_single_event(
    db: Session,
    chain: ChainService,
    event: AuditOutbox,
) -> AuditOutbox:
    """Process one pending outbox event end-to-end.

    Steps:
    1. Parse the stored JSON payload.
    2. Route the event to the correct ``ChainService`` method.
    3. Save the returned ``tx_hash`` and mark the event ``submitted``.
    4. Call ``chain.verify_transaction(tx_hash)`` to confirm on-chain.
    5. Mark the event ``confirmed`` if the tx is valid, or ``failed`` otherwise.

    On any exception during chain submission, the event is marked ``failed``
    (which increments ``retry_count``; the outbox service handles promotion to
    permanently-failed after ``MAX_RETRIES``).

    Args:
        db:    Active SQLAlchemy session. The caller is responsible for committing.
        chain: ChainService implementation to use for blockchain calls.
        event: The ``AuditOutbox`` row to process.

    Returns:
        The updated ``AuditOutbox`` instance (``confirmed`` or ``failed``).
    """
    payload = _parse_payload(event.payload)

    try:
        tx_result = _call_chain(chain, event, payload)
    except UnknownEventTypeError:
        logger.warning(
            "Unknown event_type %r for outbox row %s â€” marking failed (no retry).",
            event.event_type,
            event.id,
        )
        # Force retry_count to MAX_RETRIES so it won't be retried
        event.retry_count = outbox_service.MAX_RETRIES - 1
        return outbox_service.mark_failed(db, event)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Chain submission failed for outbox row %s: %s", event.id, exc
        )
        return outbox_service.mark_failed(db, event)

    # Submission succeeded â€” persist tx_hash
    outbox_service.mark_submitted(db, event, tx_hash=tx_result.tx_hash)
    logger.info(
        "Outbox row %s submitted to chain: tx_hash=%s", event.id, tx_result.tx_hash
    )

    # Verify the transaction was accepted by the chain
    try:
        confirmed = chain.verify_transaction(tx_result.tx_hash)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Transaction verification failed for tx %s (row %s): %s",
            tx_result.tx_hash, event.id, exc,
        )
        return outbox_service.mark_failed(db, event)

    if confirmed:
        logger.info("Outbox row %s confirmed on chain.", event.id)
        return outbox_service.mark_confirmed(db, event)

    logger.warning(
        "Transaction %s not confirmed for outbox row %s â€” marking failed.",
        tx_result.tx_hash, event.id,
    )
    return outbox_service.mark_failed(db, event)


def process_pending_events(
    db: Session,
    chain: ChainService,
    *,
    batch_size: int = 100,
) -> tuple[int, int]:
    """Fetch and process all pending outbox events in a single batch run.

    Each event is committed independently: a failure on one event does NOT
    roll back the others.

    Args:
        db:         Active SQLAlchemy session.
        chain:      ChainService implementation to use for blockchain calls.
        batch_size: Maximum number of events to process per call (default 100).

    Returns:
        A ``(confirmed, failed)`` tuple counting the outcomes of this batch run.
    """
    events = outbox_service.get_pending_events(db, limit=batch_size)
    confirmed_count = 0
    failed_count = 0

    for event in events:
        result = process_single_event(db, chain, event)
        db.commit()

        if result.status == "confirmed":
            confirmed_count += 1
        else:
            failed_count += 1

    if events:
        logger.info(
            "Outbox batch complete: %d confirmed, %d failed (of %d processed).",
            confirmed_count, failed_count, len(events),
        )

    return confirmed_count, failed_count


async def run_forever(interval_seconds: int = 5) -> None:
    """Continuously poll and process pending audit outbox events in the background."""
    import asyncio
    from app.db import SessionLocal
    from app.deps import get_chain_service

    logger.info("Outbox worker loop started (interval=%ss)", interval_seconds)
    while True:
        try:
            chain = get_chain_service()
            with SessionLocal() as db:
                process_pending_events(db, chain)
        except asyncio.CancelledError:
            logger.info("Outbox worker loop cancelled")
            break
        except Exception as exc:
            logger.error("Outbox worker loop exception: %s", exc)
        await asyncio.sleep(interval_seconds)
