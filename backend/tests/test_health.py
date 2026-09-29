def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_requires_auth(client):
    assert client.get("/api/files").status_code == 401
    assert client.get("/api/files", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_dev_login_and_me(client):
    r = client.post("/api/auth/dev-login", json={"user_id": "u2"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "manager"


def test_dev_login_unknown_id_is_404(client):
    assert client.post("/api/auth/dev-login", json={"user_id": "nope"}).status_code == 404


def test_wallet_nonce_works_with_no_auth(client):
    r = client.post("/api/auth/nonce", json={"address": "0xAAA1"})  # mixed case - gets lowercased
    assert r.status_code == 200
    body = r.json()
    assert len(body["nonce"]) == 64 and body["nonce"] in body["message"]
