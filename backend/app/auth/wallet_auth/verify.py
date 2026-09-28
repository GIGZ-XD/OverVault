"""Signature verification and address-to-user linking (Pannaga).

Uses eth_account to recover the signer from an EIP-191 personal_sign message.
This is the only place signature verification happens; routes must call verify_wallet_login().
"""
from __future__ import annotations

from dataclasses import dataclass

from eth_account import Account
from eth_account.messages import encode_defunct

from app.auth.wallet_auth.nonce import consume_nonce, get_message_for_nonce, NonceStore


# ---------------------------------------------------------------------------
# WalletIdentity — the value returned to Vineeth's JWT layer
# ---------------------------------------------------------------------------

@dataclass
class WalletIdentity:
    """Verified wallet identity, ready to be exchanged for a JWT.

    Pannaga produces this; Vineeth's auth route consumes it.
    """
    address: str   # lowercase, verified
    user_id: str   # from the users table
    role: str      # employee | manager | admin | auditor


# ---------------------------------------------------------------------------
# Error types
# ---------------------------------------------------------------------------

class WalletAuthError(Exception):
    """Base class for wallet-auth errors."""
    code: str = "wallet_auth_error"


class NonceExpiredError(WalletAuthError):
    code = "nonce_expired"


class InvalidSignatureError(WalletAuthError):
    code = "invalid_signature"


class AddressNotFoundError(WalletAuthError):
    code = "address_not_found"


# ---------------------------------------------------------------------------
# User lookup — thin interface for Vineeth's user DB layer
# ---------------------------------------------------------------------------

def _default_user_lookup(address: str) -> tuple[str, str] | None:
    """Look up (user_id, role) by wallet address.

    This is a placeholder that should be replaced by a real DB query.
    Vineeth owns the actual implementation; we call it through a
    dependency-injected callable so tests can mock it.

    Returns:
        (user_id, role) tuple, or None if not found.
    """
    # Placeholder — real implementation will query the users table
    _fixture: dict[str, tuple[str, str]] = {
        "0xaaa1": ("u1", "employee"),
        "0xbbb2": ("u2", "manager"),
        "0xccc3": ("u3", "admin"),
        "0xddd4": ("u4", "auditor"),
    }
    return _fixture.get(address)


# ---------------------------------------------------------------------------
# Core verification logic
# ---------------------------------------------------------------------------

def verify_wallet_signature(
    *,
    address: str,
    signature: str,
    nonce: str,
) -> bool:
    """Return True if *signature* is a valid EIP-191 personal_sign of the
    nonce message by *address*.

    Does NOT consume the nonce — call this only after fetching it.
    """
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
    """Full wallet login verification.

    Steps:
    1. Normalise address to lowercase.
    2. Consume the nonce (single-use).  Raises NonceExpiredError if absent/expired.
    3. Verify the signature against the consumed nonce.  Raises InvalidSignatureError.
    4. Look up the user linked to the address.  Raises AddressNotFoundError.
    5. Return a WalletIdentity for the JWT layer.

    Args:
        address:     Wallet address from the login request.
        signature:   Hex signature from the wallet.
        nonce_store: Optional injected nonce store (for tests).
        user_lookup: Optional injected user-lookup callable (for tests).
                     Signature: (address: str) -> (user_id, role) | None

    Raises:
        NonceExpiredError:     No valid nonce found for the address.
        InvalidSignatureError: Signature does not match the address.
        AddressNotFoundError:  Address is not linked to any user.
    """
    address = address.lower()
    lookup = user_lookup or _default_user_lookup

    # Step 2 — consume nonce (atomic single-use)
    nonce = consume_nonce(address, store=nonce_store)
    if nonce is None:
        raise NonceExpiredError(f"No valid nonce for {address}")

    # Step 3 — verify signature
    if not verify_wallet_signature(address=address, signature=signature, nonce=nonce):
        raise InvalidSignatureError(f"Signature does not match {address}")

    # Step 4 — link to user
    user = lookup(address)
    if user is None:
        raise AddressNotFoundError(f"Address {address} is not registered")

    user_id, role = user
    return WalletIdentity(address=address, user_id=user_id, role=role)
