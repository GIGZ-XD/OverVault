"""Dev-only login (default until Pannaga's wallet auth is wired in)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import Role, User
from app.services.rbac import Forbidden, NotFound

SEED_USERS = [
    ("admin@overvault.dev", "Ada Admin", Role.admin),
    ("manager@overvault.dev", "Mira Manager", Role.manager),
    ("employee@overvault.dev", "Eli Employee", Role.employee),
    ("employee2@overvault.dev", "Emma Employee", Role.employee),
    ("auditor@overvault.dev", "Aiden Auditor", Role.auditor),
]


def seed_dev_users(db: Session) -> None:
    for email, name, role in SEED_USERS:
        if db.scalar(select(User).where(User.email == email)) is None:
            db.add(User(email=email, name=name, role=role))
    db.commit()


def dev_login(db: Session, email: str) -> User:
    if get_settings().auth_mode != "dev":
        raise Forbidden("Dev login is disabled.")
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not user.is_active:
        raise NotFound("No such dev user.")
    return user
