"""Exercises Sriganesh's real audit pipeline end to end (not the audit_calls
spy other tests use) - confirms record()'s adapter, the outbox stub, the
shared Base fix, and the fixed /audit routes all actually work together."""
import pytest
from fastapi.testclient import TestClient

from app.auth.jwt import create_access_token
from app.db import get_db
from app.main import create_app
from app.models.audit_outbox import AuditOutbox


@pytest.fixture()
def real_client(db):
    """Like the `client` fixture, but WITHOUT the audit_calls spy - audit.record
    runs for real, so these tests see actual AuditOutbox rows."""
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


@pytest.fixture()
def real_auth(users):
    def _headers(name: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(users[name])}"}

    return _headers


@pytest.fixture()
def real_uploaded(real_client, real_auth):
    r = real_client.post(
        "/api/files", headers=real_auth("employee"),
        files={"upload": ("report.txt", b"hello v1", "text/plain")}, data={"comment": "first"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_mutation_writes_a_real_outbox_row_and_shares_the_transaction(db, real_uploaded):
    fid = real_uploaded["id"]
    rows = db.query(AuditOutbox).filter(AuditOutbox.reference_id == fid).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.event_type == "file.created" and row.status == "pending" and row.actor == real_uploaded["owner"]
    assert '"resource_type": "file"' in row.payload


def test_expiry_job_uses_system_actor_not_null(real_client, real_auth, users, db, real_uploaded):
    from datetime import timedelta

    from app.models.base import utcnow
    from app.models.permission import Permission
    from app.workers import expiry_job

    fid = real_uploaded["id"]
    pid = real_client.post(
        f"/api/files/{fid}/permissions", headers=real_auth("employee"),
        json={"grantee": users["employee2"].id, "permission": "read"},
    ).json()["id"]
    perm = db.get(Permission, pid)
    perm.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    expiry_job.run_once(db)
    row = (
        db.query(AuditOutbox)
        .filter(AuditOutbox.event_type == "permission.expired", AuditOutbox.reference_id == fid)
        .one()
    )
    assert row.actor == "system"  # not NULL - AuditOutbox.actor is NOT NULL


def test_audit_route_returns_the_files_trail_in_order(real_client, real_auth, real_uploaded):
    fid = real_uploaded["id"]
    real_client.post(f"/api/files/{fid}/versions", headers=real_auth("employee"), files={"upload": ("x", b"v2")})
    r = real_client.get(f"/api/audit/{fid}", headers=real_auth("employee"))
    assert r.status_code == 200
    events = [e["event_type"] for e in r.json()]
    assert events == ["file.created", "version.created"]


def test_audit_route_requires_auth(real_client):
    assert real_client.get("/api/audit/some-id").status_code == 401
