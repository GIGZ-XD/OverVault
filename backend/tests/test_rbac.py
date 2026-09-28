def test_stranger_cannot_see_or_download(client, auth, uploaded):
    fid = uploaded["id"]
    assert client.get("/api/files", headers=auth("employee2")).json() == []
    assert client.get(f"/api/files/{fid}", headers=auth("employee2")).status_code == 403
    assert client.get(f"/api/files/{fid}/download", headers=auth("employee2")).status_code == 403


def test_admin_sees_everything(client, auth, uploaded):
    assert len(client.get("/api/files", headers=auth("admin")).json()) == 1
    assert client.get(f"/api/files/{uploaded['id']}/download", headers=auth("admin")).status_code == 200


def test_auditor_metadata_yes_content_no(client, auth, uploaded):
    fid, h = uploaded["id"], auth("auditor")
    assert len(client.get("/api/files", headers=h).json()) == 1
    assert client.get(f"/api/files/{fid}/versions", headers=h).status_code == 200
    assert client.get(f"/api/files/{fid}/download", headers=h).status_code == 403


def test_users_listing_by_role(client, auth):
    assert client.get("/api/users", headers=auth("employee")).status_code == 403
    assert client.get("/api/users", headers=auth("manager")).status_code == 200
    assert client.get("/api/users", headers=auth("auditor")).status_code == 200


def test_dashboard_summary(client, auth, uploaded):
    r = client.get("/api/dashboard/summary", headers=auth("employee"))
    assert r.status_code == 200 and r.json()["total_files"] == 1 and r.json()["total_versions"] == 1
