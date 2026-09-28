def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_requires_auth(client):
    assert client.get("/api/files").status_code == 401
    assert client.get("/api/files", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_dev_login_and_me(client):
    r = client.post("/api/auth/dev-login", json={"email": "manager@overvault.dev"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "manager"


def test_wallet_routes_501_until_module_exists(client):
    assert client.post("/api/auth/nonce", json={"address": "0xabc"}).status_code in (200, 501)
