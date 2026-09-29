"""Tests for Phase 3: Production Audit Pipeline.

Covers:
- Step 1: AuditEvent model fields, enum types, metadata serialization, and defaults
- Step 2: Database Outbox Pattern (processing, retry, dead_letter, confirmed, error tracking)
- Step 3: Outbox Worker reliability (retry delay backoff, structured error handling)
- Step 4: Transaction metadata (TxResult fields, get_transaction_details on Fake/Real chain)
- Step 5: Verification APIs (GET /audit/{file_id}, GET /audit/{file_id}/verify, GET /transaction/{tx_hash})
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.audit import get_db
from app.chain.base import TxResult
from app.chain.fake import FakeChainService
from app.deps import get_chain_service
from app.main import app
from app.models.audit_event import AuditEvent, AuditEventType
from app.models.audit_outbox import AuditOutbox, Base
from app.services import outbox as outbox_service
from app.workers.outbox_worker import process_pending_events, process_single_event

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)


@pytest.fixture()
def db():
    """In-memory SQLite session with tables created."""
    Base.metadata.create_all(_TEST_ENGINE)
    with Session(_TEST_ENGINE) as session:
        yield session
    Base.metadata.drop_all(_TEST_ENGINE)


@pytest.fixture()
def client(db):
    """FastAPI TestClient with overridden DB and Chain dependencies."""
    fake_chain = FakeChainService()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_chain_service] = lambda: fake_chain
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# STEP 1: Audit Event Model Tests
# ---------------------------------------------------------------------------


class TestAuditEventModel:
    def test_audit_event_types_enum(self):
        expected_types = {
            "FILE_UPLOADED",
            "FILE_HASHED",
            "OWNERSHIP_REGISTERED",
            "PERMISSION_GRANTED",
            "FILE_ACCESSED",
            "FILE_SHARED",
            "FILE_DELETED",
        }
        actual_types = {e.value for e in AuditEventType}
        assert expected_types.issubset(actual_types)

    def test_audit_event_creation_and_defaults(self, db):
        event = AuditEvent(
            event_type=AuditEventType.FILE_UPLOADED,
            file_id="file-uuid-123",
            actor="user-alice",
            content_hash="sha256:abc123hash",
        )
        event.event_metadata = {"ip": "127.0.0.1", "size_bytes": 1048576}
        db.add(event)
        db.flush()

        assert event.event_id is not None
        assert len(event.event_id) == 36
        assert event.event_type == "FILE_UPLOADED"
        assert event.file_id == "file-uuid-123"
        assert event.actor == "user-alice"
        assert event.content_hash == "sha256:abc123hash"
        assert event.chain_status == "pending"
        assert event.transaction_hash is None
        assert event.event_metadata == {"ip": "127.0.0.1", "size_bytes": 1048576}
        assert isinstance(event.timestamp, datetime)

    def test_audit_event_to_dict(self, db):
        event = AuditEvent(
            event_type=AuditEventType.OWNERSHIP_REGISTERED,
            file_id="file-456",
            actor="0xOwnerWallet",
            chain_status="confirmed",
            transaction_hash="0x1234567890abcdef",
        )
        db.add(event)
        db.flush()

        data = event.to_dict()
        assert data["file_id"] == "file-456"
        assert data["chain_status"] == "confirmed"
        assert data["transaction_hash"] == "0x1234567890abcdef"
        assert data["metadata"] == {}


# ---------------------------------------------------------------------------
# STEP 2 & 3: Outbox Lifecycle, Worker Reliability & Retry Backoff
# ---------------------------------------------------------------------------


class TestOutboxLifecycleAndRetries:
    def test_retry_delay_schedule(self):
        assert outbox_service.get_retry_delay(1) == 5.0
        assert outbox_service.get_retry_delay(2) == 30.0
        assert outbox_service.get_retry_delay(3) == 300.0
        assert outbox_service.get_retry_delay(4) == 1800.0
        assert outbox_service.get_retry_delay(5) == 3600.0

    def test_mark_processing_state(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="file-1", actor="user-1"
        )
        outbox_service.mark_processing(db, event)
        assert event.status == "processing"

    def test_mark_retry_and_dead_letter_transition(self, db):
        event = outbox_service.create_event(
            db, event_type="upload", reference_id="file-1", actor="user-1"
        )
        outbox_service.mark_retry(db, event, error="Transient network glitch")
        assert event.status == "retry"
        assert event.retry_count == 1
        assert event.last_error == "Transient network glitch"

        # Advance to max retries
        for _ in range(outbox_service.MAX_RETRIES - 1):
            outbox_service.mark_retry(db, event, error="Still failing")

        assert event.status == "dead_letter"
        assert event.retry_count == outbox_service.MAX_RETRIES
        assert event.processed_at is not None

    def test_mark_dead_letter_directly(self, db):
        event = outbox_service.create_event(
            db, event_type="invalid_action", reference_id="file-bad", actor="user-1"
        )
        outbox_service.mark_dead_letter(db, event, error="Malformed payload data")
        assert event.status == "dead_letter"
        assert event.last_error == "Malformed payload data"
        assert event.processed_at is not None

    def test_get_pending_events_includes_retry_status(self, db):
        e1 = outbox_service.create_event(
            db, event_type="upload", reference_id="f1", actor="a"
        )
        e2 = outbox_service.create_event(
            db, event_type="upload", reference_id="f2", actor="b"
        )
        outbox_service.mark_retry(db, e2, error="Fail once")

        pending = outbox_service.get_pending_events(db)
        assert len(pending) == 2
        statuses = {e.status for e in pending}
        assert statuses == {"pending", "retry"}

    def test_worker_end_to_end_success(self, db):
        chain = FakeChainService()
        event = outbox_service.create_event(
            db, event_type="FILE_UPLOADED", reference_id="file-99", actor="alice"
        )
        result = process_single_event(db, chain, event)

        assert result.status == "confirmed"
        assert result.tx_hash is not None
        assert result.processed_at is not None


# ---------------------------------------------------------------------------
# STEP 4: Transaction Metadata Tests
# ---------------------------------------------------------------------------


class TestTransactionMetadata:
    def test_tx_result_dataclass_fields(self):
        res = TxResult(
            tx_hash="0xabc123",
            status="confirmed",
            block_number=42,
            gas_used=21000,
            confirmations=5,
            chain_id=1337,
            timestamp=1700000000,
        )
        assert res.tx_hash == "0xabc123"
        assert res.status == "confirmed"
        assert res.block_number == 42
        assert res.gas_used == 21000
        assert res.confirmations == 5
        assert res.chain_id == 1337
        assert res.timestamp == 1700000000

    def test_fake_chain_get_transaction_details(self):
        chain = FakeChainService()
        res = chain.log_audit("FILE_UPLOADED", "file-101", "user-bob")
        details = chain.get_transaction_details(res.tx_hash)

        assert details["tx_hash"] == res.tx_hash
        assert details["status"] == "confirmed"
        assert details["block_number"] is not None
        assert details["gas_used"] == 21000
        assert details["confirmations"] >= 1
        assert details["chain_id"] == 1337


# ---------------------------------------------------------------------------
# STEP 5: Verification API Tests
# ---------------------------------------------------------------------------


class TestAuditVerificationAPI:
    def test_get_audit_trail_empty(self, client):
        response = client.get("/audit/file-empty-999")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_audit_verify_unverified(self, client):
        response = client.get("/audit/file-nonexistent/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "file-nonexistent"
        assert data["integrity"] == "unverified"
        assert data["ownership"] == "unverified"
        assert data["audit_events"] == 0
        assert data["latest_transaction"] is None

    def test_get_audit_verify_confirmed(self, client, db):
        # Create confirmed event
        event = outbox_service.create_event(
            db, event_type="FILE_UPLOADED", reference_id="file-verify-1", actor="user-1"
        )
        outbox_service.mark_submitted(db, event, tx_hash="0xconfirmedtxhash123")
        outbox_service.mark_confirmed(db, event)
        db.commit()

        response = client.get("/audit/file-verify-1/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "file-verify-1"
        assert data["integrity"] == "verified"
        assert data["ownership"] == "verified"
        assert data["audit_events"] == 1
        assert data["latest_transaction"] == "0xconfirmedtxhash123"

    def test_get_transaction_endpoint(self, client):
        fake_chain = FakeChainService()
        app.dependency_overrides[get_chain_service] = lambda: fake_chain

        res = fake_chain.log_audit("FILE_SHARED", "file-shared-1", "user-carol")

        response = client.get(f"/transaction/{res.tx_hash}")
        assert response.status_code == 200
        data = response.json()
        assert data["tx_hash"] == res.tx_hash
        assert data["status"] == "confirmed"
        assert data["gas_used"] == 21000
        assert data["confirmations"] >= 1
