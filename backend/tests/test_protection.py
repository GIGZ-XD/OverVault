def prot(client, auth, fid, mode, by="employee"):
    return client.put(f"/api/files/{fid}/protection", headers=auth(by), json={"protection": mode})


def test_append_only_blocks_rollback_and_delete_but_allows_new_versions(client, auth, uploaded):
    h, fid = auth("employee"), uploaded["id"]
    assert prot(client, auth, fid, "append_only").status_code == 200
    assert client.post(f"/api/files/{fid}/versions", headers=h, files={"upload": ("x", b"v2")}).status_code == 201
    assert client.post(f"/api/files/{fid}/versions/1/rollback", headers=h).status_code == 409
    assert client.delete(f"/api/files/{fid}", headers=h).status_code == 409


def test_read_only_freezes_everything(client, auth, uploaded):
    h, fid = auth("employee"), uploaded["id"]
    prot(client, auth, fid, "read_only")
    assert client.post(f"/api/files/{fid}/versions", headers=h, files={"upload": ("x", b"v2")}).status_code == 409
    assert client.delete(f"/api/files/{fid}", headers=h).status_code == 409
    assert client.get(f"/api/files/{fid}/download", headers=h).status_code == 200  # reads still fine


def test_only_admin_can_loosen(client, auth, uploaded, audit_calls):
    fid = uploaded["id"]
    prot(client, auth, fid, "read_only")
    assert prot(client, auth, fid, "none", by="employee").status_code == 403
    assert prot(client, auth, fid, "none", by="admin").status_code == 200
    assert [c["action"] for c in audit_calls].count("file.protection_changed") == 2
