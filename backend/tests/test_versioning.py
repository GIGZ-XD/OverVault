import hashlib


def test_upload_creates_v1_with_hash_and_audit(client, uploaded, audit_calls):
    assert uploaded["current_version"] == 1 and uploaded["my_access"] == "manage"
    assert audit_calls[-1]["action"] == "file.created"
    assert audit_calls[-1]["content_hash"] == hashlib.sha256(b"hello v1").hexdigest()


def test_download_verifies_and_returns_content(client, auth, uploaded):
    r = client.get(f"/api/files/{uploaded['id']}/download", headers=auth("employee"))
    assert r.content == b"hello v1"
    assert r.headers["X-Content-SHA256"] == hashlib.sha256(b"hello v1").hexdigest()


def test_new_version_history_and_rollback(client, auth, uploaded, audit_calls):
    h, fid = auth("employee"), uploaded["id"]
    v2 = client.post(f"/api/files/{fid}/versions", headers=h, files={"upload": ("r.txt", b"v2 data")}, data={"comment": "edit"})
    assert v2.status_code == 201 and v2.json()["version_number"] == 2
    rb = client.post(f"/api/files/{fid}/versions/1/rollback", headers=h)
    assert rb.status_code == 201
    assert rb.json()["version_number"] == 3 and rb.json()["rolled_back_from"] == 1
    hist = client.get(f"/api/files/{fid}/versions", headers=h).json()
    assert [v["version_number"] for v in hist] == [3, 2, 1]  # history never rewritten
    assert client.get(f"/api/files/{fid}/download", headers=h).content == b"hello v1"
    assert [c["action"] for c in audit_calls][-2:] == ["version.created", "version.rollback"]


def test_empty_upload_rejected(client, auth):
    r = client.post("/api/files", headers=auth("employee"), files={"upload": ("e.txt", b"")})
    assert r.status_code == 422


def test_auditor_cannot_create_file(client, auth):
    r = client.post("/api/files", headers=auth("auditor"), files={"upload": ("a.txt", b"x")})
    assert r.status_code == 403


def test_soft_delete(client, auth, uploaded):
    h, fid = auth("employee"), uploaded["id"]
    assert client.delete(f"/api/files/{fid}", headers=h).status_code == 204
    assert client.get(f"/api/files/{fid}", headers=h).status_code == 404
    assert client.get("/api/files", headers=h).json() == []
