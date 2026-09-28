"""Nonce creation, storage and expiry (Pannaga).

In development/test mode the nonce store is an in-memory dict.
In production this should be replaced with a DB-backed store or Redis,
but the interface (create_nonce / get_nonce / consume_nonce) stays the same.
"""
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field
from threading import Lock

# ---------------------------------------------------------------------------
# Nonce store (in-memory, suitable for single-process dev/test)
# ---------------------------------------------------------------------------

NONCE_TTL_SECONDS = 300  # 5 minutes per spec


@dataclass
class _NonceRecord:
    nonce: str
    expires_at: float  # monotonic seconds


class _NonceStore:
    """Thread-safe in-memory nonce store.

    One active nonce per wallet address at a time.
    """

    def __init__(self) -> None:
        self._store: dict[str, _NonceRecord] = {}
        self._lock = Lock()

    def put(self, address: str, nonce: str, ttl: int = NONCE_TTL_SECONDS) -> None:
        with self._lock:
            self._store[address] = _NonceRecord(
                nonce=nonce,
                expires_at=time.monotonic() + ttl,
            )

    def get(self, address: str) -> str | None:
        """Return the nonce if valid and not expired; else None."""
        with self._lock:
            record = self._store.get(address)
            if record is None:
                return None
            if time.monotonic() > record.expires_at:
                del self._store[address]
                return None
            return record.nonce

    def consume(self, address: str) -> str | None:
        """Remove and return the nonce (single-use).  Returns None if absent/expired."""
        with self._lock:
            record = self._store.pop(address, None)
            if record is None:
                return None
            if time.monotonic() > record.expires_at:
                return None
            return record.nonce


# Module-level singleton — replaced in tests via dependency injection
_store = _NonceStore()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

MESSAGE_TEMPLATE = "Sign in to OverVault.\n\nNonce: {nonce}"


def create_nonce(address: str, store: _NonceStore | None = None) -> dict[str, str]:
    """Generate a fresh nonce for *address* and return the nonce + message.

    Args:
        address: Wallet address, will be normalised to lowercase.
        store:   Optional nonce store (injected in tests).

    Returns:
        dict with keys ``nonce`` and ``message``.
    """
    s = store or _store
    nonce = secrets.token_hex(32)
    s.put(address.lower(), nonce)
    message = MESSAGE_TEMPLATE.format(nonce=nonce)
    return {"nonce": nonce, "message": message}


def get_message_for_nonce(nonce: str) -> str:
    """Reconstruct the exact message string that was presented to the wallet."""
    return MESSAGE_TEMPLATE.format(nonce=nonce)


def consume_nonce(address: str, store: _NonceStore | None = None) -> str | None:
    """Consume (single-use) the nonce for *address*.

    Returns the nonce string if valid, or None if absent/expired.
    """
    s = store or _store
    return s.consume(address.lower())


def peek_nonce(address: str, store: _NonceStore | None = None) -> str | None:
    """Non-destructive look-up — used for testing only.  Not part of the auth flow."""
    s = store or _store
    return s.get(address.lower())


# Expose the store class so tests can inject a fresh instance
NonceStore = _NonceStore
