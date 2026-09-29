"""Dev-only login (AUTH_MODE=dev). Bypasses wallet auth entirely.

SEED_USERS' first four rows (ids u1-u4) are the team's SHARED fixture identity
set: the same ids/names/roles/wallet addresses Pannaga's wallet_auth/verify.py
placeholder lookup used, and that Pavan's mocks/fixtures (users.json) use.
Dev-login and wallet-login now resolve to the SAME accounts. u5 is Vineeth's
own addition - a second employee with no wallet, needed to test permission
grants between two peers; it's not part of the shared team fixture.

DevLoginRequest.user_id (not email) per the frozen schemas/auth.py.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import Role, User
from app.services.rbac import Forbidden, NotFound

SEED_USERS = [
    # id,   name,              role,          wallet_address
    ("u1", "Pavan", Role.employee, "0xaaa1"),
    ("u2", "Ravi Kumar", Role.manager, "0xbbb2"),
    ("u3", "Meera Iyer", Role.admin, "0xccc3"),
    ("u4", "Kiran Shah", Role.auditor, "0xddd4"),
    ("u5", "Priya Nair", Role.employee, None),
]


def seed_dev_users(db: Session, force: bool = False) -> None:
    # Only seed fake team fixtures during automated testing
    targets = SEED_USERS if (force or get_settings().app_env == "test") else [
        ("u1", "Pavan", Role.admin, "0xaaa1")
    ]
    for user_id, name, role, wallet_address in targets:
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
    if get_settings().auth_mode != "dev":
        raise Forbidden("Dev login is disabled.")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise NotFound("No such dev user.")
    return user
