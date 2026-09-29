"""Protection modes: read_only and append_only enforcement."""
from sqlalchemy.orm import Session

from app.models.file import File, ProtectionMode
from app.models.permission import PermissionLevel
from app.models.user import User
from app.models.base import utcnow
from app.services import audit, permissions, rbac
from app.services.rbac import Conflict, Forbidden

_ALLOWED = {
    ProtectionMode.none: {"new_version", "rollback", "delete"},
    ProtectionMode.append_only: {"new_version"},
    ProtectionMode.read_only: set(),
}
_STRENGTH = {ProtectionMode.none: 0, ProtectionMode.append_only: 1, ProtectionMode.read_only: 2}


def assert_allowed(file: File, action: str) -> None:
    if action not in _ALLOWED[file.protection_mode]:
        raise Conflict(f"File is {file.protection_mode.value}: '{action}' is not allowed.")


def set_mode(db: Session, file: File, actor: User, mode: ProtectionMode) -> File:
    permissions.require_access(db, actor, file, PermissionLevel.manage)
    if mode == file.protection_mode:
        return file
    # Tightening needs 'manage'; loosening a lock is admin-only.
    if _STRENGTH[mode] < _STRENGTH[file.protection_mode] and not rbac.has_capability(actor, "protection.loosen"):
        raise Forbidden("Only an admin can loosen a file's protection.")
    previous = file.protection_mode
    file.protection_mode = mode
    file.updated_at = utcnow()
    audit.record(
        db,
        actor_id=actor.id,
        action="file.protection_changed",
        resource_type="file",
        resource_id=file.id,
        metadata={"from": previous.value, "to": mode.value},
    )
    db.commit()
    return file
