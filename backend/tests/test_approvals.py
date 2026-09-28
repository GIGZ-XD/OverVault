def submit(client, auth, fid, by="employee"):
    return client.post(f"/api/files/{fid}/approvals", headers=auth(by), json={"comment": "please review"})


def test_full_approval_flow_emits_audit(client, auth, uploaded, audit_calls):
    fid = uploaded["id"]
    a = submit(client, auth, fid)
    assert a.status_code == 201 and a.json()["status"] == "pending"
    aid = a.json()["id"]
    inbox = client.get("/api/approvals", headers=auth("manager")).json()
    assert [x["id"] for x in inbox] == [aid]
    d = client.post(f"/api/approvals/{aid}/approve", headers=auth("manager"), json={"comment": "ok", "signature": "0xsig"})
    assert d.status_code == 200 and d.json()["status"] == "approved"
    assert client.get(f"/api/files/{fid}", headers=auth("employee")).json()["approved_version"] == 1
    last = audit_calls[-1]
    assert last["action"] == "approval.approved" and last["metadata"]["signature"] == "0xsig"


def test_reject(client, auth, uploaded):
    aid = submit(client, auth, uploaded["id"]).json()["id"]
    r = client.post(f"/api/approvals/{aid}/reject", headers=auth("admin"), json={"comment": "no"})
    assert r.json()["status"] == "rejected"
    assert client.get(f"/api/files/{uploaded['id']}", headers=auth("employee")).json()["approved_version"] is None


def test_employee_cannot_review_and_no_double_decision(client, auth, uploaded):
    aid = submit(client, auth, uploaded["id"]).json()["id"]
    assert client.post(f"/api/approvals/{aid}/approve", headers=auth("employee")).status_code == 403
    assert client.post(f"/api/approvals/{aid}/approve", headers=auth("manager")).status_code == 200
    assert client.post(f"/api/approvals/{aid}/reject", headers=auth("manager")).status_code == 409


def test_no_self_review_and_duplicate_pending(client, auth, users, uploaded):
    fid = uploaded["id"]
    client.post(f"/api/files/{fid}/permissions", headers=auth("employee"),
                json={"user_id": users["manager"].id, "level": "write"})
    aid = submit(client, auth, fid, by="manager").json()["id"]
    assert client.post(f"/api/approvals/{aid}/approve", headers=auth("manager")).status_code == 403
    assert submit(client, auth, fid, by="manager").status_code == 409


def test_cannot_submit_without_write_access(client, auth, uploaded):
    assert submit(client, auth, uploaded["id"], by="employee2").status_code == 403
