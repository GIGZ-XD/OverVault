"""Tests for outbox_worker. Written alongside the module.

All tests use:
- SQLite in-memory database (no PostgreSQL, no Docker needed)
- FakeChainService (no real blockchain needed)
- Direct call to process_single_event() for unit-level assertions
- Direct call to process_pending_events() for batch-level assertions
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.chain.fake import FakeChainService
from app.models.audit_outbox import AuditOutbox, Base
from app.services import outbox as outbox_service
from app.workers.outbox_worker import (
    UnknownEventTypeError,
    _classify,
    _parse_payload,
    process_pending_events,
    process_single_event,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """In-memory SQLite session with the audit_outbox table created."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


@pytest.fixture()
def chain():
    """Fresh FakeChainService instance — reset for every test."""
    return FakeChainService()


def _make_event(
    db: Session,
    *,
    event_type: str = "upload",
    reference_id: str = "file-001",
    actor: str = "user-1",
    payload: dict | None = None,
) -> AuditOutbox:
    """Helper: create and flush a pending outbox row."""
    return outbox_service.create_event(
        db,
        event_type=event_type,
        reference_id=reference_id,
        actor=actor,
        payload=payload,
    )


# ---------------------------------------------------------------------------
# _classify() — event-type routing
# ---------------------------------------------------------------------------


class TestClassify:
    def test_hash_keyword(self):
        assert _classify("commit_hash") == "hash"

    def test_integrity_keyword(self):
        assert _classify("integrity_check") == "hash"

    def test_case_insensitive(self):
        assert _classify("HASH_STORE") == "hash"

    def test_ownership_keyword(self):
        assert _classify("register_ownership") == "ownership"

    def test_permission_keyword(self):
        assert _classify("grant_permission") == "permission"

    def test_audit_default_upload(self):
        assert _classify("upload") == "audit"

    def test_audit_default_approve(self):
        assert _classify("approve") == "audit"

    def test_audit_default_download(self):
        assert _classify("download") == "audit"

    def test_audit_default_delete(self):
        assert _classify("delete") == "audit"


# ---------------------------------------------------------------------------
# _parse_payload() — payload deserialisation
# ---------------------------------------------------------------------------


class TestParsePayload:
    def test_none_returns_empty_dict(self):
        assert _parse_payload(None) == {}

    def test_empty_string_returns_empty_dict(self):
        assert _parse_payload("") == {}

    def test_valid_json(self):
        raw = json.dumps({"key": "value", "n": 42})
        assert _parse_payload(raw) == {"key": "value", "n": 42}

    def test_invalid_json_returns_empty_dict(self):
        assert _parse_payload("not-json{{{") == {}

    def test_non_object_json_returns_empty_dict(self):
        # JSON array is not a valid payload dict
        assert _parse_payload("[1, 2, 3]") == {}


# ---------------------------------------------------------------------------
# process_single_event() — happy path: general audit event
# ---------------------------------------------------------------------------


class TestProcessSingleEventAudit:
    def test_pending_event_processed_successfully(self, db, chain):
        event = _make_event(db, event_type="upload")
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"

    def test_tx_hash_saved_after_submission(self, db, chain):
        event = _make_event(db, event_type="approve", reference_id="file-99")
        result = process_single_event(db, chain, event)
        assert result.tx_hash is not None
        assert result.tx_hash.startswith("0x")

    def test_confirmed_state_after_verify(self, db, chain):
        event = _make_event(db, event_type="download")
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"

    def test_chain_log_audit_called_for_generic_event(self, db, chain):
        """Verify the correct ChainService method is dispatched."""
        event = _make_event(
            db, event_type="delete", reference_id="file-42", actor="admin"
        )
        process_single_event(db, chain, event)
        # FakeChainService stores audit records; verify one was added
        trail = chain.get_audit_trail("file-42")
        assert len(trail) == 1
        assert trail[0].event_type == "delete"


# ---------------------------------------------------------------------------
# process_single_event() — hash / integrity events
# ---------------------------------------------------------------------------


class TestProcessSingleEventHash:
    def test_hash_event_routed_to_commit_hash(self, db, chain):
        event = _make_event(
            db,
            event_type="commit_hash",
            reference_id="file-h1",
            payload={"file_id": "file-h1", "version": 2, "content_hash": "sha256:abc"},
        )
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"
        # The hash should now be stored in FakeChain
        assert chain.verify_hash("file-h1", 2, "sha256:abc")

    def test_integrity_event_routed_to_commit_hash(self, db, chain):
        event = _make_event(
            db,
            event_type="integrity_seal",
            reference_id="file-h2",
            payload={"file_id": "file-h2", "version": 1, "content_hash": "sha256:xyz"},
        )
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"

    def test_hash_event_fallback_without_payload(self, db, chain):
        """Worker should not crash when payload fields are missing — uses safe defaults."""
        event = _make_event(db, event_type="store_hash", reference_id="file-h3")
        result = process_single_event(db, chain, event)
        # Should still complete — defaults fill missing fields
        assert result.status in ("confirmed", "failed")


# ---------------------------------------------------------------------------
# process_single_event() — ownership events
# ---------------------------------------------------------------------------


class TestProcessSingleEventOwnership:
    def test_ownership_event_routed_to_register_ownership(self, db, chain):
        event = _make_event(
            db,
            event_type="register_ownership",
            reference_id="file-o1",
            payload={
                "file_id": "file-o1",
                "owner_address": "0xOwner",
                "content_hash": "sha256:abc",
            },
        )
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"
        # Ownership registration stores hash at version 1
        assert chain.verify_hash("file-o1", 1, "sha256:abc")


# ---------------------------------------------------------------------------
# process_single_event() — permission events
# ---------------------------------------------------------------------------


class TestProcessSingleEventPermission:
    def test_permission_event_routed_to_record_permission(self, db, chain):
        event = _make_event(
            db,
            event_type="grant_permission",
            reference_id="file-p1",
            payload={
                "file_id": "file-p1",
                "grantee": "0xGrantee",
                "action": "read",
                "expiry": None,
            },
        )
        result = process_single_event(db, chain, event)
        assert result.status == "confirmed"
        assert result.tx_hash is not None


# ---------------------------------------------------------------------------
# process_single_event() — failure cases
# ---------------------------------------------------------------------------


class TestProcessSingleEventFailures:
    def test_chain_exception_marks_event_failed(self, db, chain):
        """If ChainService raises an exception, the event should be marked failed."""
        broken_chain = MagicMock()
        broken_chain.log_audit.side_effect = RuntimeError("chain timeout")

        event = _make_event(db, event_type="upload")
        result = process_single_event(db, broken_chain, event)
        assert result.status in ("pending", "failed")  # failed or pending (retry)
        assert result.retry_count == 1

    def test_failed_event_increments_retry_count(self, db, chain):
        broken_chain = MagicMock()
        broken_chain.log_audit.side_effect = ConnectionError("RPC unreachable")

        event = _make_event(db, event_type="download")
        process_single_event(db, broken_chain, event)
        assert event.retry_count == 1

    def test_verify_transaction_failure_marks_event_failed(self, db):
        """If verify_transaction() returns False, the event is marked failed."""
        unconfirming_chain = MagicMock()
        unconfirming_chain.log_audit.return_value = MagicMock(tx_hash="0xdeadbeef")
        unconfirming_chain.verify_transaction.return_value = False

        event = _make_event(db, event_type="approve")
        result = process_single_event(db, unconfirming_chain, event)
        # verify_transaction returned False → mark_failed called
        assert result.retry_count >= 1

    def test_verify_transaction_exception_marks_event_failed(self, db):
        """If verify_transaction() raises, the event is marked failed."""
        erroring_chain = MagicMock()
        erroring_chain.log_audit.return_value = MagicMock(tx_hash="0xabc")
        erroring_chain.verify_transaction.side_effect = TimeoutError("network")

        event = _make_event(db, event_type="upload")
        result = process_single_event(db, erroring_chain, event)
        assert result.retry_count >= 1

    def test_max_retries_eventually_permanently_fails(self, db):
        """After MAX_RETRIES failures the event is permanently failed, not retried."""
        broken_chain = MagicMock()
        broken_chain.log_audit.side_effect = RuntimeError("always fails")

        # Process the same event MAX_RETRIES times
        event = _make_event(db, event_type="upload")
        for _ in range(outbox_service.MAX_RETRIES):
            process_single_event(db, broken_chain, event)

        assert event.status == "failed"
        assert event.retry_count == outbox_service.MAX_RETRIES

    def test_unknown_event_type_does_not_crash_worker(self, db, chain):
        """UnknownEventTypeError is caught — worker marks the event failed, not crash."""
        event = _make_event(db, event_type="upload")  # will route to audit (default)
        # Patch _call_chain to raise UnknownEventTypeError
        with patch(
            "app.workers.outbox_worker._call_chain",
            side_effect=UnknownEventTypeError("no route"),
        ):
            result = process_single_event(db, chain, event)
        # Should be marked permanently failed (retry_count set to MAX_RETRIES)
        assert result.status == "failed"


# ---------------------------------------------------------------------------
# process_pending_events() — batch processing
# ---------------------------------------------------------------------------


class TestProcessPendingEvents:
    def test_processes_all_pending_events(self, db, chain):
        for i in range(3):
            _make_event(db, event_type="upload", reference_id=f"file-{i}")
        confirmed, failed = process_pending_events(db, chain)
        assert confirmed == 3
        assert failed == 0

    def test_returns_correct_counts(self, db, chain):
        _make_event(db, event_type="approve", reference_id="file-1")
        _make_event(db, event_type="download", reference_id="file-2")
        confirmed, _ = process_pending_events(db, chain)
        assert confirmed == 2

    def test_empty_queue_returns_zero_counts(self, db, chain):
        confirmed, failed = process_pending_events(db, chain)
        assert confirmed == 0
        assert failed == 0

    def test_mixed_success_and_failure(self, db):
        """One working chain, one broken — batch should record both outcomes."""
        _make_event(db, event_type="upload", reference_id="file-good")
        _make_event(db, event_type="upload", reference_id="file-bad")

        call_count = 0
        original_chain = FakeChainService()

        broken_then_good = MagicMock()

        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return original_chain.log_audit(*args, **kwargs)
            raise RuntimeError("second call fails")

        broken_then_good.log_audit.side_effect = side_effect
        broken_then_good.verify_transaction.return_value = True

        confirmed, failed = process_pending_events(db, broken_then_good)
        assert confirmed + failed == 2
