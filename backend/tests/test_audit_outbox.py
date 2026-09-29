"""Tests for the audit outbox pipeline.

Covers:
- AuditOutbox model field defaults
- outbox service CRUD functions (create, pending query, state transitions)
- audit.record() integration
- AuditEventCreate / AuditEventResponse schema validation

Uses SQLite in-memory so no real database or migrations are needed.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.audit_outbox import AuditOutbox, Base
from app.schemas.audit import AuditEventCreate, AuditEventResponse
from app.services import audit as audit_service
from app.services import outbox as outbox_service

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """Provide an in-memory SQLite session with the audit outbox table created."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


# ---------------------------------------------------------------------------
# AuditOutbox model
# ---------------------------------------------------------------------------


class TestAuditOutboxModel:
    def test_default_status_is_pending(self, db):
        event = AuditOutbox(
            event_type="upload",
            reference_id="file-1",
            actor="user-1",
        )
        db.add(event)
        db.flush()
        assert event.status == "pending"

    def test_default_retry_count_is_zero(self, db):
        event = AuditOutbox(
            event_type="download", reference_id="file-2", actor="user-2"
        )
        db.add(event)
        db.flush()
        assert event.retry_count == 0

    def test_default_tx_hash_is_none(self, db):
        event = AuditOutbox(event_type="approve", reference_id="file-3", actor="user-3")
        db.add(event)
        db.flush()
        assert event.tx_hash is None

    def test_id_is_assigned(self, db):
        event = AuditOutbox(event_type="grant", reference_id="file-4", actor="user-4")
        db.add(event)
        db.flush()
        assert event.id is not None
        assert len(event.id) == 36  # UUID string length

    def test_created_at_is_utc_datetime(self, db):
        event = AuditOutbox(event_type="delete", reference_id="file-5", actor="user-5")
        db.add(event)
        db.flush()
        assert isinstance(event.created_at, datetime)


# ---------------------------------------------------------------------------
# outbox service — create_event
# ---------------------------------------------------------------------------


class TestOutboxCreateEvent:
    def test_creates_pending_row(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="alice"
        )
        assert event.status == "pending"

    def test_payload_is_json_encoded(self, db):
        event = outbox_service.create_event(
            db,
            event_type="upload",
            reference_id="f2",
            actor="alice",
            payload={"size": 1024},
        )
        assert event.payload is not None
        assert json.loads(event.payload) == {"size": 1024}

    def test_none_payload_stored_as_none(self, db):
        event = outbox_service.create_event(
            db, event_type="download", reference_id="f3", actor="bob", payload=None
        )
        assert event.payload is None


# ---------------------------------------------------------------------------
# outbox service — get_pending_events
# ---------------------------------------------------------------------------


class TestOutboxGetPendingEvents:
    def test_returns_pending_events(self, db):
        outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.create_event(
            db, event_type="approve", reference_id="f2", actor="b"
        )
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 2

    def test_excludes_submitted_events(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.mark_submitted(db, event, tx_hash="0xabc")
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 0

    def test_excludes_confirmed_events(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.mark_submitted(db, event, tx_hash="0xdef")
        outbox_service.mark_confirmed(db, event)
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 0

    def test_excludes_exhausted_retries(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        # Exhaust all retries
        for _ in range(outbox_service.MAX_RETRIES):
            outbox_service.mark_failed(db, event)
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 0


# ---------------------------------------------------------------------------
# outbox service — state transitions
# ---------------------------------------------------------------------------


class TestOutboxStateTransitions:
    def test_mark_submitted_sets_tx_hash(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.mark_submitted(db, event, tx_hash="0xaabbcc")
        assert event.status == "submitted"
        assert event.tx_hash == "0xaabbcc"

    def test_mark_confirmed_sets_status(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.mark_submitted(db, event, tx_hash="0xdeadbeef")
        outbox_service.mark_confirmed(db, event)
        assert event.status == "confirmed"

    def test_mark_failed_increments_retry(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        outbox_service.mark_failed(db, event)
        assert event.retry_count == 1
        assert event.status == "pending"  # still retryable

    def test_mark_failed_max_retries_sets_failed_status(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        for _ in range(outbox_service.MAX_RETRIES):
            outbox_service.mark_failed(db, event)
        assert event.status == "failed"
        assert event.retry_count == outbox_service.MAX_RETRIES


# ---------------------------------------------------------------------------
# audit.record() integration
# ---------------------------------------------------------------------------


class TestAuditRecord:
    def test_returns_audit_event_response(self, db):
        response = audit_service.record(
            db,
            event_type="upload",
            reference_id="file-xyz",
            actor="user-42",
        )
        assert isinstance(response, AuditEventResponse)

    def test_response_fields_match_input(self, db):
        response = audit_service.record(
            db,
            event_type="approve",
            reference_id="file-abc",
            actor="reviewer-1",
            payload={"note": "approved"},
        )
        assert response.event_type == "approve"
        assert response.reference_id == "file-abc"
        assert response.actor == "reviewer-1"
        assert response.payload == {"note": "approved"}

    def test_initial_status_is_pending(self, db):
        response = audit_service.record(
            db, event_type="download", reference_id="file-1", actor="user-1"
        )
        assert response.status == "pending"

    def test_initial_tx_hash_is_none(self, db):
        response = audit_service.record(
            db, event_type="delete", reference_id="file-1", actor="user-1"
        )
        assert response.tx_hash is None

    def test_row_appears_in_pending_events(self, db):
        audit_service.record(
            db, event_type="upload", reference_id="file-99", actor="user-5"
        )
        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 1
        assert pending[0].reference_id == "file-99"


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


class TestSchemas:
    def test_audit_event_create_valid(self):
        data = AuditEventCreate(
            event_type="upload",
            reference_id="file-1",
            actor="user-1",
            payload={"size": 512},
        )
        assert data.event_type == "upload"
        assert data.payload == {"size": 512}

    def test_audit_event_create_no_payload(self):
        data = AuditEventCreate(event_type="approve", reference_id="f1", actor="u1")
        assert data.payload is None

    def test_audit_event_response_from_dict(self):
        now = datetime.now(UTC)
        resp = AuditEventResponse(
            id="abc-123",
            event_type="upload",
            reference_id="file-1",
            actor="user-1",
            payload=None,
            status="pending",
            tx_hash=None,
            created_at=now,
        )
        assert resp.id == "abc-123"
        assert resp.status == "pending"
        assert resp.tx_hash is None
