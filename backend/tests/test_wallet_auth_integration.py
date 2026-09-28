"""Real end-to-end wallet login: an actual EIP-191 signature, verified by
Pannaga's real verify.py (not mocked), resolved to a real User via Vineeth's
db_wallet_lookup, and exchanged for a real JWT."""
from eth_account import Account
from eth_account.messages import encode_defunct


def _sign(private_key: str, message: str) -> str:
    signed = Account.sign_message(encode_defunct(text=message), private_key=private_key)
    return signed.signature.hex()


def test_full_wallet_login_flow(client, db):
    acct = Account.create()
    address = acct.address

    nonce_resp = client.post("/api/auth/nonce", json={"address": address})
    assert nonce_resp.status_code == 200
    message = nonce_resp.json()["message"]
    signature = _sign(acct.key.hex(), message)

    # Unregistered address -> 403 address_not_found (no auto-provisioning)
    r = client.post("/api/auth/wallet-login", json={"address": address, "signature": signature})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "address_not_found"

    # Register the address to a real user, then get a fresh nonce (the first was consumed)
    from app.models.user import User

    user = db.query(User).filter(User.id == "u5").one()
    user.wallet_address = address.lower()
    db.commit()

    nonce_resp2 = client.post("/api/auth/nonce", json={"address": address})
    message2 = nonce_resp2.json()["message"]
    signature2 = _sign(acct.key.hex(), message2)

    r2 = client.post("/api/auth/wallet-login", json={"address": address, "signature": signature2})
    assert r2.status_code == 200
    body = r2.json()
    assert body["user"]["id"] == "u5" and body["user"]["role"] == "employee"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["id"] == "u5"


def test_wrong_signature_rejected(client):
    acct = Account.create()
    other = Account.create()
    nonce_resp = client.post("/api/auth/nonce", json={"address": acct.address})
    message = nonce_resp.json()["message"]
    bad_signature = _sign(other.key.hex(), message)  # signed by the WRONG key

    r = client.post("/api/auth/wallet-login", json={"address": acct.address, "signature": bad_signature})
    assert r.status_code == 401 and r.json()["detail"]["code"] == "invalid_signature"


def test_nonce_is_single_use(client, db):
    from app.models.user import User

    acct = Account.create()
    user = db.query(User).filter(User.id == "u5").one()
    user.wallet_address = acct.address.lower()
    db.commit()

    nonce_resp = client.post("/api/auth/nonce", json={"address": acct.address})
    message = nonce_resp.json()["message"]
    signature = _sign(acct.key.hex(), message)

    r1 = client.post("/api/auth/wallet-login", json={"address": acct.address, "signature": signature})
    assert r1.status_code == 200
    r2 = client.post("/api/auth/wallet-login", json={"address": acct.address, "signature": signature})
    assert r2.status_code == 401 and r2.json()["detail"]["code"] == "nonce_expired"  # consumed, not re-usable
