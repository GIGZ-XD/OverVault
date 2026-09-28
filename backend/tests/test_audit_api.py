"""Tests for the Audit API routes.

Covers:
- POST /audit/record — success, validation errors, response schema
- GET  /audit/{file_id} — non-empty trail, empty trail, ordering, schema

Uses FastAPI TestClient with dependency_overrides to inject a SQLite
in-memory session.  No PostgreSQL, no Docker, no network required.

SQLite threading note:
    FastAPI TestClient runs requests in a worker thread.  We use
    ``connect_args={"check_same_thread": False}`` and a
    ``StaticPool`` so the same in-memory database is visible to the
    test session and the TestClient thread alike.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.audit import get_db
from app.main import app
from app.models.audit_outbox import Base


# ---------------------------------------------------------------------------
# Shared in-memory engine (StaticPool keeps the same connection across threads)
# ---------------------------------------------------------------------------

_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)


def _setup_db():
    Base.metadata.create_all(_TEST_ENGINE)


def _teardown_db():
    Base.metadata.drop_all(_TEST_ENGINE)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_db():
    """Create tables before each test, drop them after."""
    _setup_db()
    yield
    _teardown_db()


@pytest.fixture()
def client():
    """TestClient with the real get_db overridden by a SQLite session."""

    def override_get_db():
        with Session(_TEST_ENGINE) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /audit/record — success cases
# ---------------------------------------------------------------------------


class TestPostAuditRecord:
    def test_returns_201_on_success(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-001",
                "actor": "user-42",
            },
        )
        assert resp.status_code == 201

    def test_response_contains_id(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-001",
                "actor": "user-42",
            },
        )
        data = resp.json()
        assert "id" in data
        assert len(data["id"]) == 36  # UUID

    def test_initial_status_is_pending(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-001",
                "actor": "user-42",
            },
        )
        assert resp.json()["status"] == "pending"

    def test_initial_tx_hash_is_null(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-001",
                "actor": "user-42",
            },
        )
        assert resp.json()["tx_hash"] is None

    def test_response_fields_match_request(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_APPROVED",
                "reference_id": "file-xyz",
                "actor": "reviewer-1",
                "payload": {"hash": "abc123"},
            },
        )
        data = resp.json()
        assert data["event_type"] == "FILE_APPROVED"
        assert data["reference_id"] == "file-xyz"
        assert data["actor"] == "reviewer-1"
        assert data["payload"] == {"hash": "abc123"}

    def test_payload_is_optional(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_DOWNLOADED",
                "reference_id": "file-002",
                "actor": "user-99",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["payload"] is None

    def test_created_at_is_present(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-003",
                "actor": "user-1",
            },
        )
        assert "created_at" in resp.json()
        assert resp.json()["created_at"] is not None


# ---------------------------------------------------------------------------
# POST /audit/record — validation error cases
# ---------------------------------------------------------------------------


class TestPostAuditRecordValidation:
    def test_missing_event_type_returns_422(self, client):
        resp = client.post(
            "/audit/record",
            json={"reference_id": "file-001", "actor": "user-1"},
        )
        assert resp.status_code == 422

    def test_missing_reference_id_returns_422(self, client):
        resp = client.post(
            "/audit/record",
            json={"event_type": "upload", "actor": "user-1"},
        )
        assert resp.status_code == 422

    def test_missing_actor_returns_422(self, client):
        resp = client.post(
            "/audit/record",
            json={"event_type": "upload", "reference_id": "file-1"},
        )
        assert resp.status_code == 422

    def test_empty_event_type_returns_422(self, client):
        resp = client.post(
            "/audit/record",
            json={"event_type": "", "reference_id": "file-1", "actor": "user-1"},
        )
        assert resp.status_code == 422

    def test_empty_body_returns_422(self, client):
        resp = client.post("/audit/record", json={})
        assert resp.status_code == 422

    def test_event_type_too_long_returns_422(self, client):
        resp = client.post(
            "/audit/record",
            json={
                "event_type": "X" * 65,  # max_length=64
                "reference_id": "file-1",
                "actor": "user-1",
            },
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /audit/{file_id} — audit trail retrieval
# ---------------------------------------------------------------------------


class TestGetAuditTrail:
    def test_returns_200_for_existing_file(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-trail-1",
                "actor": "user-1",
            },
        )
        resp = client.get("/audit/file-trail-1")
        assert resp.status_code == 200

    def test_returns_list(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-trail-2",
                "actor": "user-1",
            },
        )
        resp = client.get("/audit/file-trail-2")
        assert isinstance(resp.json(), list)

    def test_returns_correct_event_count(self, client):
        for event in ["FILE_UPLOADED", "FILE_APPROVED", "FILE_DOWNLOADED"]:
            client.post(
                "/audit/record",
                json={
                    "event_type": event,
                    "reference_id": "file-multi",
                    "actor": "user-1",
                },
            )
        resp = client.get("/audit/file-multi")
        assert len(resp.json()) == 3

    def test_returns_empty_list_for_unknown_file(self, client):
        resp = client.get("/audit/file-does-not-exist")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_trail_entry_contains_required_fields(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-schema-check",
                "actor": "user-1",
            },
        )
        trail = client.get("/audit/file-schema-check").json()
        entry = trail[0]
        assert "event_type" in entry
        assert "actor" in entry
        assert "status" in entry
        assert "tx_hash" in entry
        assert "created_at" in entry

    def test_trail_status_is_pending_initially(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-pending-check",
                "actor": "user-1",
            },
        )
        trail = client.get("/audit/file-pending-check").json()
        assert trail[0]["status"] == "pending"

    def test_trail_tx_hash_is_null_before_worker(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-txhash-check",
                "actor": "user-1",
            },
        )
        trail = client.get("/audit/file-txhash-check").json()
        assert trail[0]["tx_hash"] is None

    def test_trail_ordered_by_created_at(self, client):
        for event in ["FILE_UPLOADED", "FILE_APPROVED", "FILE_SHARED"]:
            client.post(
                "/audit/record",
                json={
                    "event_type": event,
                    "reference_id": "file-ordered",
                    "actor": "user-1",
                },
            )
        trail = client.get("/audit/file-ordered").json()
        assert trail[0]["event_type"] == "FILE_UPLOADED"
        assert trail[1]["event_type"] == "FILE_APPROVED"
        assert trail[2]["event_type"] == "FILE_SHARED"

    def test_trail_only_returns_events_for_requested_file(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-A",
                "actor": "user-1",
            },
        )
        client.post(
            "/audit/record",
            json={
                "event_type": "FILE_UPLOADED",
                "reference_id": "file-B",
                "actor": "user-2",
            },
        )
        trail_a = client.get("/audit/file-A").json()
        trail_b = client.get("/audit/file-B").json()
        assert len(trail_a) == 1
        assert len(trail_b) == 1
        assert trail_a[0]["actor"] == "user-1"
        assert trail_b[0]["actor"] == "user-2"

    def test_trail_event_type_matches_recorded(self, client):
        client.post(
            "/audit/record",
            json={
                "event_type": "PERMISSION_GRANTED",
                "reference_id": "file-perm",
                "actor": "admin",
            },
        )
        trail = client.get("/audit/file-perm").json()
        assert trail[0]["event_type"] == "PERMISSION_GRANTED"
