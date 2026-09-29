"""DB-backed wallet-address -> (user_id, role) lookup.

Pannaga's verify_wallet_login() takes an injectable `user_lookup` callable
(see her TODO in wallet_auth/verify.py: "Vineeth owns the actual
implementation"). This is that implementation - a real query against
User.wallet_address, replacing her 4-address placeholder fixture.

Per wallet_auth.md section 9: "Admins add users and pre-register their wallet
addresses... Attempting login from an unregistered address returns 403." So
this does NOT create a user on a miss - returning None here is exactly what
makes verify_wallet_login raise AddressNotFoundError.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def db_wallet_lookup(db: Session):
    def _lookup(address: str) -> tuple[str, str] | None:
        user = db.scalar(select(User).where(User.wallet_address == address))
        if user is None or not user.is_active:
            return None
        return user.id, user.role.value

    return _lookup
