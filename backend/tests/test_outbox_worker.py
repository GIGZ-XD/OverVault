"""Tests for outbox_worker: polling pending audit events and committing on fake chain."""
import pytest
from sqlalchemy import select
from app.chain.fake import FakeChainService
from app.models.audit_outbox import AuditOutbox
from app.workers import outbox_worker


def test_outbox_worker_processes_pending_events(db):
    # Setup pending audit outbox row
    row = AuditOutbox(
        event_type="file.created",
        reference_id="test-file-123",
        actor="u1",
        status="pending",
    )
    db.add(row)
    db.commit()

    # Verify initially pending
    assert row.status == "pending"
    assert row.tx_hash is None

    # Run outbox worker once
    chain = FakeChainService()
    processed_count = outbox_worker.run_once(db=db, chain=chain)

    assert processed_count == 1

    # Reload row and verify confirmed with real fake tx hash
    db.refresh(row)
    assert row.status == "confirmed"
    assert row.tx_hash is not None
    assert row.tx_hash.startswith("0x")


def test_outbox_worker_ignores_confirmed_events(db):
    row = AuditOutbox(
        event_type="file.updated",
        reference_id="test-file-456",
        actor="u2",
        status="confirmed",
        tx_hash="0xalreadyconfirmed",
    )
    db.add(row)
    db.commit()

    processed_count = outbox_worker.run_once(db=db)
    assert processed_count == 0
