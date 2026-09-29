"""Signature verification and address-to-user linking (Pannaga).

Uses eth_account to recover the signer from an EIP-191 personal_sign message.
This is the only place signature verification happens; routes must call verify_wallet_login().
"""
from __future__ import annotations

from dataclasses import dataclass

from eth_account import Account
from eth_account.messages import encode_defunct

from app.auth.wallet_auth.nonce import consume_nonce, get_message_for_nonce, NonceStore


@dataclass
class WalletIdentity:
    """Verified wallet identity, ready to be exchanged for a JWT."""
    address: str
    user_id: str
    role: str


class WalletAuthError(Exception):
    code: str = "wallet_auth_error"


class NonceExpiredError(WalletAuthError):
    code = "nonce_expired"


class InvalidSignatureError(WalletAuthError):
    code = "invalid_signature"


class AddressNotFoundError(WalletAuthError):
    code = "address_not_found"


def _default_user_lookup(address: str) -> tuple[str, str] | None:
    """Placeholder - real implementation is injected by the route (Vineeth's
    DB-backed lookup in app/auth/user_lookup.py), so this default is unused
    in practice. Kept only as a fallback if a caller forgets to inject one."""
    _fixture: dict[str, tuple[str, str]] = {
        "0xaaa1": ("u1", "employee"),
        "0xbbb2": ("u2", "manager"),
        "0xccc3": ("u3", "admin"),
        "0xddd4": ("u4", "auditor"),
    }
    return _fixture.get(address)


def verify_wallet_signature(*, address: str, signature: str, nonce: str) -> bool:
    message = get_message_for_nonce(nonce)
    try:
        msg = encode_defunct(text=message)
        recovered = Account.recover_message(msg, signature=signature)
        return recovered.lower() == address.lower()
    except Exception:
        return False


def verify_wallet_login(
    *,
    address: str,
    signature: str,
    nonce_store: NonceStore | None = None,
    user_lookup=None,
) -> WalletIdentity:
    address = address.lower()
    lookup = user_lookup or _default_user_lookup

    nonce = consume_nonce(address, store=nonce_store)
    if nonce is None:
        raise NonceExpiredError(f"No valid nonce for {address}")

    if not verify_wallet_signature(address=address, signature=signature, nonce=nonce):
        raise InvalidSignatureError(f"Signature does not match {address}")

    user = lookup(address)
    if user is None:
        raise AddressNotFoundError(f"Address {address} is not registered")

    user_id, role = user
    return WalletIdentity(address=address, user_id=user_id, role=role)
