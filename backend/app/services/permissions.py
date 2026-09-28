"""File-level permissions: ownership, grants with expiry, revocation."""
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.base import as_utc, utcnow
from app.models.file import File
from app.models.permission import Permission, PermissionLevel
from app.models.user import Role, User
from app.services import audit
from app.services.rbac import Conflict, Forbidden, Invalid, NotFound

RANK = {PermissionLevel.read: 1, PermissionLevel.write: 2, PermissionLevel.manage: 3}


def _active_clauses():
    return (
        Permission.revoked_at.is_(None),
        or_(Permission.expires_at.is_(None), Permission.expires_at > utcnow()),
    )


def active_grants(db: Session, *, file_id: str | None = None, user_id: str | None = None) -> list[Permission]:
    q = select(Permission).where(*_active_clauses())
    if file_id:
        q = q.where(Permission.file_id == file_id)
    if user_id:
        q = q.where(Permission.user_id == user_id)
    return list(db.scalars(q.order_by(Permission.created_at)))


def granted_file_ids(user_id: str):
    """Subquery of file ids the user currently holds an active grant on."""
    return select(Permission.file_id).where(Permission.user_id == user_id, *_active_clauses())


def effective_level(db: Session, user: User, file: File, *, content: bool = False) -> PermissionLevel | None:
    """Owner/admin -> manage. Else best active grant. Auditors get metadata-only read."""
    if user.role == Role.admin or file.owner_id == user.id:
        return PermissionLevel.manage
    grants = active_grants(db, file_id=file.id, user_id=user.id)
    if grants:
        return max((g.level for g in grants), key=lambda lvl: RANK[lvl])
    if user.role == Role.auditor and not content:
        return PermissionLevel.read
    return None


def require_access(
    db: Session, user: User, file: File, required: PermissionLevel, *, content: bool = False
) -> PermissionLevel:
    level = effective_level(db, user, file, content=content)
    if level is None or RANK[level] < RANK[required]:
        raise Forbidden(f"You need '{required.value}' access on this file.")
    return level


def grant(
    db: Session,
    file: File,
    actor: User,
    *,
    grantee_id: str,
    level: PermissionLevel,
    expires_at: datetime | None = None,
    signature: str | None = None,
) -> Permission:
    require_access(db, actor, file, PermissionLevel.manage)
    grantee = db.get(User, grantee_id)
    if grantee is None or not grantee.is_active:
        raise NotFound("Grantee not found.")
    if grantee.id == file.owner_id:
        raise Conflict("The owner already has full access.")
    expires = as_utc(expires_at)
    if expires is not None and expires <= utcnow():
        raise Invalid("expires_at must be in the future.")

    existing = next(iter(active_grants(db, file_id=file.id, user_id=grantee_id)), None)
    if existing:  # update in place instead of stacking grants
        existing.level, existing.expires_at, existing.granted_by = level, expires, actor.id
        perm = existing
    else:
        perm = Permission(
            file_id=file.id, user_id=grantee_id, level=level, granted_by=actor.id, expires_at=expires
        )
        db.add(perm)
    db.flush()
    audit.record(
        db,
        actor_id=actor.id,
        action="permission.granted",
        resource_type="permission",
        resource_id=perm.id,
        metadata={
            "file_id": file.id,
            "grantee_id": grantee_id,
            "level": level.value,
            "expires_at": expires.isoformat() if expires else None,
            "signature": signature,
        },
    )
    db.commit()
    return perm


def revoke(db: Session, permission_id: str, actor: User, *, signature: str | None = None) -> Permission:
    perm = db.get(Permission, permission_id)
    if perm is None:
        raise NotFound("Permission not found.")
    file = db.get(File, perm.file_id)
    require_access(db, actor, file, PermissionLevel.manage)
    if perm.revoked_at is not None:
        raise Conflict("Permission already revoked.")
    perm.revoked_at, perm.revoked_reason = utcnow(), "revoked"
    audit.record(
        db,
        actor_id=actor.id,
        action="permission.revoked",
        resource_type="permission",
        resource_id=perm.id,
        metadata={"file_id": file.id, "grantee_id": perm.user_id, "signature": signature},
    )
    db.commit()
    return perm


def list_for_file(db: Session, file: File, actor: User, *, include_inactive: bool = False) -> list[Permission]:
    require_access(db, actor, file, PermissionLevel.manage)
    if include_inactive:
        return list(db.scalars(select(Permission).where(Permission.file_id == file.id)))
    return active_grants(db, file_id=file.id)
