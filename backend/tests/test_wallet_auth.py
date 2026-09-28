"""Tests for wallet_auth (Pannaga).

Covers:
- Valid signature
- Invalid signature
- Incorrect / expired nonce
- Unknown wallet address
- Replayed nonce attempt
- Wallet cancellation path (no signature submitted)
- Nonce TTL / expiry
- Address normalisation (case insensitivity)
- Message format consistency
"""
from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from app.auth.wallet_auth.nonce import (
    NonceStore,
    NONCE_TTL_SECONDS,
    create_nonce,
    consume_nonce,
    get_message_for_nonce,
    MESSAGE_TEMPLATE,
    peek_nonce,
)
from app.auth.wallet_auth.verify import (
    WalletIdentity,
    NonceExpiredError,
    InvalidSignatureError,
    AddressNotFoundError,
    verify_wallet_login,
    verify_wallet_signature,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_account():
    """Return a fresh throwaway eth_account Account object."""
    return Account.create()


def _sign(account, message: str) -> str:
    """EIP-191 personal_sign."""
    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)
    return signed.signature.hex()


def _fresh_store() -> NonceStore:
    return NonceStore()


def _user_lookup_fixture(address: str):
    """Test fixture user lookup."""
    users = {
        "0xaaa1": ("u1", "employee"),
        "0xbbb2": ("u2", "manager"),
    }
    return users.get(address.lower())


# ---------------------------------------------------------------------------
# Nonce tests
# ---------------------------------------------------------------------------

class TestNonce:
    def test_create_nonce_returns_nonce_and_message(self):
        store = _fresh_store()
        result = create_nonce("0xABC", store=store)
        assert "nonce" in result
        assert "message" in result
        assert result["nonce"] in result["message"]

    def test_message_format_matches_template(self):
        store = _fresh_store()
        result = create_nonce("0xaaa1", store=store)
        expected = MESSAGE_TEMPLATE.format(nonce=result["nonce"])
        assert result["message"] == expected

    def test_address_normalised_to_lowercase(self):
        store = _fresh_store()
        create_nonce("0xABC", store=store)
        # The internal store key must be lowercase
        assert "0xabc" in store._store
        assert "0xABC" not in store._store
        assert "0XABC" not in store._store
        # peek (which also normalises) should find the nonce under any case
        assert peek_nonce("0xabc", store=store) is not None
        assert peek_nonce("0xABC", store=store) is not None

    def test_nonce_is_single_use(self):
        store = _fresh_store()
        create_nonce("0xaaa1", store=store)
        first = consume_nonce("0xaaa1", store=store)
        second = consume_nonce("0xaaa1", store=store)
        assert first is not None
        assert second is None

    def test_nonce_replaced_on_second_create(self):
        store = _fresh_store()
        r1 = create_nonce("0xaaa1", store=store)
        r2 = create_nonce("0xaaa1", store=store)
        # Only the latest nonce should be valid
        assert peek_nonce("0xaaa1", store=store) == r2["nonce"]
        assert peek_nonce("0xaaa1", store=store) != r1["nonce"]

    def test_nonce_expires_after_ttl(self):
        store = _fresh_store()
        # Inject a nonce with 0 TTL
        store.put("0xaaa1", "expirednonce", ttl=0)
        time.sleep(0.01)
        result = consume_nonce("0xaaa1", store=store)
        assert result is None

    def test_get_message_for_nonce_consistent(self):
        nonce = "abc123"
        msg = get_message_for_nonce(nonce)
        assert nonce in msg
        assert "OverVault" in msg


# ---------------------------------------------------------------------------
# Signature verification tests
# ---------------------------------------------------------------------------

class TestVerifyWalletSignature:
    def test_valid_signature_returns_true(self):
        account = _make_account()
        nonce = "testnonce42"
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)
        assert verify_wallet_signature(
            address=account.address.lower(),
            signature=sig,
            nonce=nonce,
        )

    def test_wrong_address_returns_false(self):
        account = _make_account()
        other = _make_account()
        nonce = "testnonce42"
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)
        assert not verify_wallet_signature(
            address=other.address.lower(),
            signature=sig,
            nonce=nonce,
        )

    def test_wrong_nonce_returns_false(self):
        account = _make_account()
        nonce = "correctnonce"
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)
        assert not verify_wallet_signature(
            address=account.address.lower(),
            signature=sig,
            nonce="wrongnonce",
        )

    def test_malformed_signature_returns_false(self):
        assert not verify_wallet_signature(
            address="0xaaa1",
            signature="notasignature",
            nonce="somenonce",
        )

    def test_empty_signature_returns_false(self):
        assert not verify_wallet_signature(
            address="0xaaa1",
            signature="",
            nonce="somenonce",
        )


# ---------------------------------------------------------------------------
# Full login flow tests
# ---------------------------------------------------------------------------

class TestVerifyWalletLogin:
    def _setup(self, account) -> tuple[NonceStore, str]:
        """Returns (store, nonce) after calling create_nonce for the account."""
        store = _fresh_store()
        result = create_nonce(account.address.lower(), store=store)
        return store, result["nonce"]

    def test_valid_login_returns_wallet_identity(self):
        account = _make_account()
        # Register account in fixture lookup
        address = account.address.lower()
        store, nonce = self._setup(account)
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)

        def lookup(addr):
            if addr == address:
                return ("u_test", "employee")
            return None

        identity = verify_wallet_login(
            address=address,
            signature=sig,
            nonce_store=store,
            user_lookup=lookup,
        )
        assert isinstance(identity, WalletIdentity)
        assert identity.address == address
        assert identity.user_id == "u_test"
        assert identity.role == "employee"

    def test_invalid_signature_raises(self):
        account = _make_account()
        address = account.address.lower()
        store = _fresh_store()
        create_nonce(address, store=store)

        with pytest.raises(InvalidSignatureError):
            verify_wallet_login(
                address=address,
                signature="0xdeadbeef" + "0" * 120,
                nonce_store=store,
                user_lookup=_user_lookup_fixture,
            )

    def test_missing_nonce_raises(self):
        account = _make_account()
        address = account.address.lower()
        store = _fresh_store()  # no nonce created

        with pytest.raises(NonceExpiredError):
            verify_wallet_login(
                address=address,
                signature="0xsomesig",
                nonce_store=store,
                user_lookup=_user_lookup_fixture,
            )

    def test_expired_nonce_raises(self):
        account = _make_account()
        address = account.address.lower()
        store = _fresh_store()
        store.put(address, "expirednonce", ttl=0)
        time.sleep(0.01)

        with pytest.raises(NonceExpiredError):
            verify_wallet_login(
                address=address,
                signature="0xsomesig",
                nonce_store=store,
                user_lookup=_user_lookup_fixture,
            )

    def test_unknown_address_raises(self):
        account = _make_account()
        address = account.address.lower()
        store, nonce = self._setup(account)
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)

        # lookup returns None for this address
        with pytest.raises(AddressNotFoundError):
            verify_wallet_login(
                address=address,
                signature=sig,
                nonce_store=store,
                user_lookup=lambda addr: None,
            )

    def test_nonce_replay_raises(self):
        """Using the same nonce twice must fail on the second attempt."""
        account = _make_account()
        address = account.address.lower()
        store, nonce = self._setup(account)
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)

        def lookup(addr):
            return ("u_test", "employee")

        # First login succeeds
        identity = verify_wallet_login(
            address=address,
            signature=sig,
            nonce_store=store,
            user_lookup=lookup,
        )
        assert identity is not None

        # Replay — nonce was consumed; should raise NonceExpiredError
        with pytest.raises(NonceExpiredError):
            verify_wallet_login(
                address=address,
                signature=sig,
                nonce_store=store,
                user_lookup=lookup,
            )

    def test_wallet_cancellation_path(self):
        """Simulates user cancelling the wallet prompt (no signature submitted).
        The nonce remains valid until the frontend times out; backend sees no request.
        The nonce should still be consumable after cancellation.
        """
        account = _make_account()
        address = account.address.lower()
        store = _fresh_store()
        result = create_nonce(address, store=store)
        # User cancels — frontend does NOT call wallet-login.
        # Nonce should still be in store.
        assert peek_nonce(address, store=store) == result["nonce"]

    def test_address_case_insensitive(self):
        """Login with mixed-case address should work the same as lowercase."""
        account = _make_account()
        address_lower = account.address.lower()
        store, nonce = self._setup(account)
        message = get_message_for_nonce(nonce)
        sig = _sign(account, message)

        def lookup(addr):
            return ("u_test", "employee")

        # Submit with mixed-case address
        identity = verify_wallet_login(
            address=account.address,  # mixed case from wallet
            signature=sig,
            nonce_store=store,
            user_lookup=lookup,
        )
        assert identity.address == address_lower
