from datetime import datetime, timedelta, timezone

from app.models.base import utcnow
from app.models.permission import Permission
from app.workers import expiry_job


def grant(client, auth, fid, users, who="employee2", level="read", expires=None, by="employee"):
    body = {"grantee": users[who].id, "permission": level}
    if expires:
        body["expires_at"] = expires.isoformat()
    return client.post(f"/api/files/{fid}/permissions", headers=auth(by), json=body)


def test_grant_read_allows_download_not_write(client, auth, users, uploaded):
    fid = uploaded["id"]
    g = grant(client, auth, fid, users)
    assert g.status_code == 201 and g.json()["status"] == "active"
    assert client.get(f"/api/files/{fid}/download", headers=auth("employee2")).status_code == 200
    up = client.post(f"/api/files/{fid}/versions", headers=auth("employee2"), files={"upload": ("x", b"y")})
    assert up.status_code == 403
    assert client.get("/api/files", headers=auth("employee2")).json()[0]["my_access"] == "read"


def test_only_managers_can_grant(client, auth, users, uploaded):
    fid = uploaded["id"]
    assert grant(client, auth, fid, users, who="manager", by="employee2").status_code == 403


def test_revoke_removes_access(client, auth, users, uploaded, audit_calls):
    fid = uploaded["id"]
    pid = grant(client, auth, fid, users).json()["id"]
    assert client.delete(f"/api/permissions/{pid}", headers=auth("employee")).status_code == 204
    assert client.get(f"/api/files/{fid}/download", headers=auth("employee2")).status_code == 403
    assert client.delete(f"/api/permissions/{pid}", headers=auth("employee")).status_code == 409
    assert "permission.revoked" in [c["action"] for c in audit_calls]


def test_expiry_blocks_access_and_job_audits(client, auth, users, db, uploaded, audit_calls):
    fid = uploaded["id"]
    pid = grant(client, auth, fid, users, expires=datetime.now(timezone.utc) + timedelta(hours=1)).json()["id"]
    perm = db.get(Permission, pid)
    perm.expires_at = utcnow() - timedelta(minutes=1)  # time passes
    db.commit()
    assert client.get(f"/api/files/{fid}/download", headers=auth("employee2")).status_code == 403
    assert expiry_job.run_once(db) == 1
    assert db.get(Permission, pid).revoked_reason == "expired"
    assert audit_calls[-1]["action"] == "permission.expired"
    assert expiry_job.run_once(db) == 0


def test_past_expiry_rejected_and_owner_grant_conflict(client, auth, users, uploaded):
    fid = uploaded["id"]
    assert grant(client, auth, fid, users, expires=datetime.now(timezone.utc) - timedelta(days=1)).status_code == 422
    assert grant(client, auth, fid, users, who="employee").status_code == 409


def test_regrant_updates_in_place(client, auth, users, uploaded):
    fid = uploaded["id"]
    a = grant(client, auth, fid, users, level="read").json()
    b = grant(client, auth, fid, users, level="write").json()
    assert a["id"] == b["id"] and b["permission"] == "write"
