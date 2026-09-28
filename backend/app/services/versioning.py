"""Files + versions: create, add version, rollback, read (hash-verified), delete."""
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.file import File
from app.models.permission import PermissionLevel
from app.models.user import User
from app.models.version import FileVersion
from app.services import audit, hashing, permissions, protection, rbac, storage
from app.services.rbac import NotFound


def _add_version(
    db: Session, file: File, author: User, data: bytes, comment: str, rolled_back_from: int | None = None
) -> FileVersion:
    number = file.current_version + 1
    digest = hashing.sha256_hex(data)
    key = storage.make_key(file.id, number)
    storage.save(key, data)
    version = FileVersion(
        file_id=file.id,
        version_number=number,
        sha256=digest,
        size_bytes=len(data),
        storage_key=key,
        author_id=author.id,
        comment=comment,
        rolled_back_from=rolled_back_from,
    )
    db.add(version)
    file.current_version = number
    file.updated_at = utcnow()
    db.flush()
    return version


def get_file(db: Session, file_id: str) -> File:
    file = db.get(File, file_id)
    if file is None or file.is_deleted:
        raise NotFound("File not found.")
    return file


def create_file(
    db: Session, owner: User, *, name: str, content_type: str, data: bytes, comment: str = ""
) -> tuple[File, FileVersion]:
    rbac.require_capability(owner, "file.create")
    file = File(name=name, content_type=content_type or "application/octet-stream", owner_id=owner.id)
    db.add(file)
    db.flush()
    version = _add_version(db, file, owner, data, comment or "Initial upload")
    audit.record(
        db,
        actor_id=owner.id,
        action="file.created",
        resource_type="file",
        resource_id=file.id,
        content_hash=version.sha256,
        metadata={"name": name, "version": version.version_number, "size_bytes": version.size_bytes},
    )
    db.commit()
    return file, version


def add_version(db: Session, file: File, actor: User, data: bytes, comment: str = "") -> FileVersion:
    permissions.require_access(db, actor, file, PermissionLevel.write)
    protection.assert_allowed(file, "new_version")
    version = _add_version(db, file, actor, data, comment)
    audit.record(
        db,
        actor_id=actor.id,
        action="version.created",
        resource_type="file_version",
        resource_id=version.id,
        content_hash=version.sha256,
        metadata={"file_id": file.id, "version": version.version_number, "size_bytes": version.size_bytes},
    )
    db.commit()
    return version


def get_version(db: Session, file: File, number: int) -> FileVersion:
    v = db.scalar(
        select(FileVersion).where(FileVersion.file_id == file.id, FileVersion.version_number == number)
    )
    if v is None:
        raise NotFound(f"Version {number} not found.")
    return v


def list_versions(db: Session, file: File, actor: User) -> list[FileVersion]:
    permissions.require_access(db, actor, file, PermissionLevel.read)
    return list(
        db.scalars(
            select(FileVersion)
            .where(FileVersion.file_id == file.id)
            .order_by(FileVersion.version_number.desc())
        )
    )


def read_version(
    db: Session, file: File, actor: User, number: int | None = None
) -> tuple[bytes, FileVersion]:
    """Decrypt + verify hash. Defaults to the current version."""
    permissions.require_access(db, actor, file, PermissionLevel.read, content=True)
    version = get_version(db, file, number or file.current_version)
    return storage.read_verified(version.storage_key, version.sha256), version


def rollback(db: Session, file: File, actor: User, target_number: int, comment: str = "") -> FileVersion:
    """Rollback = new version copying an old one; history is never rewritten."""
    permissions.require_access(db, actor, file, PermissionLevel.write)
    protection.assert_allowed(file, "rollback")
    target = get_version(db, file, target_number)
    data = storage.read_verified(target.storage_key, target.sha256)
    version = _add_version(
        db, file, actor, data, comment or f"Rollback to v{target_number}", rolled_back_from=target_number
    )
    audit.record(
        db,
        actor_id=actor.id,
        action="version.rollback",
        resource_type="file_version",
        resource_id=version.id,
        content_hash=version.sha256,
        metadata={"file_id": file.id, "version": version.version_number, "rolled_back_from": target_number},
    )
    db.commit()
    return version


def delete_file(db: Session, file: File, actor: User) -> None:
    """Soft delete; encrypted blobs and history are retained for audit."""
    permissions.require_access(db, actor, file, PermissionLevel.manage)
    protection.assert_allowed(file, "delete")
    file.is_deleted = True
    file.updated_at = utcnow()
    audit.record(
        db, actor_id=actor.id, action="file.deleted", resource_type="file", resource_id=file.id
    )
    db.commit()


def list_files(db: Session, user: User) -> list[File]:
    q = select(File).where(File.is_deleted.is_(False)).order_by(File.updated_at.desc())
    if not rbac.has_capability(user, "file.read_all_metadata"):
        q = q.where(or_(File.owner_id == user.id, File.id.in_(permissions.granted_file_ids(user.id))))
    return list(db.scalars(q))
