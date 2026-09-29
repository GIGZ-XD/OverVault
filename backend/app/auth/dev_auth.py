"""
Dev-only login (AUTH_MODE=dev).

This file is only for local development.
Production should use wallet authentication.

Users are created from environment variables, not hardcoded identities.
"""

import os

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import Role, User
from app.services.rbac import Forbidden, NotFound


# Optional test fixtures only.
# Keep empty for normal development.
SEED_USERS = []


def seed_dev_users(db: Session, force: bool = False) -> None:
    """
    Creates development users.

    Priority:
    1. Test mode -> use SEED_USERS
    2. Development mode -> use DEV_OWNER from .env
    """

    dev_owner = (
        os.getenv("DEV_OWNER_ID"),
        os.getenv("DEV_OWNER_NAME"),
        Role.admin,
        os.getenv("DEV_OWNER_WALLET"),
    )

    if force or get_settings().app_env == "test":
        targets = SEED_USERS
    else:
        # Only create if DEV_OWNER_ID exists
        targets = [dev_owner] if dev_owner[0] else []

    for user_id, name, role, wallet_address in targets:
        if not user_id:
            continue

        if db.get(User, user_id) is None:
            db.add(
                User(
                    id=user_id,
                    email=f"{user_id}@overvault.dev",
                    name=name,
                    role=role,
                    wallet_address=wallet_address,
                )
            )

    db.commit()


def dev_login(db: Session, user_id: str) -> User:
    """
    Development login.
    No wallet verification.
    """

    if get_settings().auth_mode != "dev":
        raise Forbidden("Dev login is disabled.")

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise NotFound("No such dev user.")

    return user
