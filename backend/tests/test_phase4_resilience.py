"""Phase 4: Blockchain Failure Recovery and Pipeline Resilience Tests.

Tests:
- Scenario 1: Transient RPC Failure & Automatic Recovery
- Scenario 2: Unrecoverable Payload & Dead-Letter Queue Isolation
- Scenario 3: Worker Crash and Recovery (Orphaned Processing States)
- Scenario 4: Dynamic Retry Schedule Progression

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.chain.base import TxResult
from app.chain.fake import FakeChainService
from app.models.audit_outbox import AuditOutbox, Base
from app.services import outbox as outbox_service
from app.workers.outbox_worker import (
    UnknownEventTypeError,
    process_pending_events,
    process_single_event,
)

# ---------------------------------------------------------------------------
# In-memory SQLite Database Engine (StaticPool for Thread & Multi-Session Safety)
# ---------------------------------------------------------------------------

_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)


@pytest.fixture()
def db():
    """Yield a clean in-memory database session."""
    Base.metadata.create_all(_TEST_ENGINE)
    with Session(_TEST_ENGINE) as session:
        yield session
    Base.metadata.drop_all(_TEST_ENGINE)


# ---------------------------------------------------------------------------
# Test Scenario 1: Transient RPC Failure & Recovery
# ---------------------------------------------------------------------------


class TestRPCFailureAndRecovery:
    def test_transient_rpc_failure_then_success(self, db):
        """Test that a transient RPC connection failure increments retries and succeeds once recovered."""
        event = outbox_service.create_event(
            db,
            event_type="FILE_UPLOADED",
            reference_id="file-rpc-test-1",
            actor="0xUserWallet",
            payload={"size": 1024},
        )
        db.commit()

        # Step 1: Simulate RPC failure on first attempt
        broken_chain = MagicMock()
        broken_chain.log_audit.side_effect = ConnectionError("MST RPC connection timed out (503 Service Unavailable)")

        res1 = process_single_event(db, broken_chain, event)
        db.commit()

        assert res1.status == "pending"  # retryable state
        assert res1.retry_count == 1
        assert "MST RPC connection timed out" in (res1.last_error or "")

        # Verify event still appears in pending queue
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 1
        assert pending[0].id == event.id

        # Step 2: Simulate RPC recovery on second attempt
        working_chain = FakeChainService()
        res2 = process_single_event(db, working_chain, event)
        db.commit()

        assert res2.status == "confirmed"
        assert res2.tx_hash is not None
        assert res2.tx_hash.startswith("0x")
        assert res2.processed_at is not None

        # Queue is now empty
        assert len(outbox_service.get_pending_events(db)) == 0


# ---------------------------------------------------------------------------
# Test Scenario 2: Unrecoverable Payload & Dead-Letter Queue Isolation
# ---------------------------------------------------------------------------


class TestPermanentFailureAndDeadLetter:
    def test_unrecoverable_failure_transitions_to_dead_letter(self, db):
        """Test that malformed payloads or invalid event classifications transition directly to dead_letter."""
        event = outbox_service.create_event(
            db,
            event_type="CORRUPTED_ACTION",
            reference_id="file-bad-payload",
            actor="0xAttacker",
            payload={"invalid": True},
        )
        db.commit()

        # Mark dead letter directly when unrecoverable
        outbox_service.mark_dead_letter(db, event, error="Malformed event signature or schema validation error")
        db.commit()

        assert event.status == "dead_letter"
        assert "Malformed event signature" in (event.last_error or "")
        assert event.processed_at is not None

        # Excluded from pending queue
        assert len(outbox_service.get_pending_events(db)) == 0

    def test_max_retries_exhaustion_moves_to_permanent_failure(self, db):
        """Test that reaching MAX_RETRIES transitions row to permanent failed / dead_letter state."""
        event = outbox_service.create_event(
            db,
            event_type="FILE_HASHED",
            reference_id="file-retry-exhaust",
            actor="0xUser",
        )
        db.commit()

        broken_chain = MagicMock()
        broken_chain.commit_hash.side_effect = RuntimeError("EVM execution reverted")

        for attempt in range(outbox_service.MAX_RETRIES):
            process_single_event(db, broken_chain, event)
            db.commit()

        assert event.status == "failed"
        assert event.retry_count == outbox_service.MAX_RETRIES
        assert event.processed_at is not None
        assert len(outbox_service.get_pending_events(db)) == 0


# ---------------------------------------------------------------------------
# Test Scenario 3: Worker Crash and Recovery
# ---------------------------------------------------------------------------


class TestWorkerCrashRecovery:
    def test_worker_crash_recovery_from_orphaned_state(self, db):
        """Simulate a worker crash midway through processing and verify clean recovery on restart."""
        # Create event and simulate that a previous worker process died while event was in 'processing' state
        event = outbox_service.create_event(
            db,
            event_type="OWNERSHIP_REGISTERED",
            reference_id="file-crash-recovery",
            actor="0xOwner",
            payload={"owner_address": "0xOwner", "content_hash": "sha256:abc"},
        )
        event.status = "processing"
        event.retry_count = 1
        event.last_error = "Worker process terminated unexpectedly (SIGKILL)"
        db.commit()

        # Reset orphaned processing events to retryable state (as done on worker startup)
        outbox_service.mark_retry(db, event, error="Recovering from worker restart")
        db.commit()

        # Verify new worker run picks up the event
        chain = FakeChainService()
        confirmed, failed = process_pending_events(db, chain)
        db.commit()

        assert confirmed == 1
        assert failed == 0
        assert event.status == "confirmed"
        assert event.tx_hash is not None


# ---------------------------------------------------------------------------
# Test Scenario 4: Dynamic Retry Progression
# ---------------------------------------------------------------------------


class TestRetryScheduleProgression:
    def test_exponential_backoff_delays(self):
        delays = [outbox_service.get_retry_delay(i) for i in range(1, 6)]
        assert delays == [5.0, 30.0, 300.0, 1800.0, 3600.0]
