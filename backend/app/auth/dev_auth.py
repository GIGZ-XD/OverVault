"""AUTH_MODE=dev: issue a JWT for a chosen test user.

This bypasses wallet authentication entirely.
Only active when AUTH_MODE=dev (never reachable in wallet mode).
"""
from __future__ import annotations

_DEV_USERS: dict[str, dict] = {
    "u1": {"user_id": "u1", "role": "employee", "address": "0xaaa1"},
    "u2": {"user_id": "u2", "role": "manager",  "address": "0xbbb2"},
    "u3": {"user_id": "u3", "role": "admin",    "address": "0xccc3"},
    "u4": {"user_id": "u4", "role": "auditor",  "address": "0xddd4"},
}


def get_dev_user(user_id: str) -> dict | None:
    """Return the test user dict or None if not found."""
    return _DEV_USERS.get(user_id)
