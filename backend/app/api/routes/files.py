from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, File as FormFile, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models.audit_outbox import AuditOutbox
from app.models.file import File
from app.models.permission import PermissionLevel
from app.models.user import User
from app.schemas.file import FileOut, ProtectionUpdate, VerifyResult
from app.services import permissions, protection, versioning
from app.services.rbac import NotFound

router = APIRouter(prefix="/files", tags=["files"])


def file_out(db: Session, user: User, f: File) -> FileOut:
    """Builds the response the mock returns (owner/size/protection/verification/hash/
    ownership_tx), plus additive fields the mock doesn't have. See schemas/file.py."""
    v = versioning.current_version(db, f)
    if v is None:
        raise NotFound("File has no versions.")
    # Look up confirmed on-chain transaction hash for this document
    tx_hash = db.scalar(
        select(AuditOutbox.tx_hash)
        .where(AuditOutbox.reference_id == f.id, AuditOutbox.tx_hash.isnot(None))
        .order_by(AuditOutbox.created_at.desc())
    )
    return FileOut(
        id=f.id,
        name=f.name,
        owner=f.owner_id,
        size=v.size_bytes,
        protection=f.protection_mode,
        verification="verified",
        hash=v.sha256,
        ownership_tx=tx_hash,
        content_type=f.content_type,
        current_version=f.current_version,
        approved_version=f.approved_version,
        created_at=f.created_at,
        updated_at=f.updated_at,
        my_access=permissions.effective_level(db, user, f),
    )


def read_upload(upload: UploadFile) -> bytes:
    # NOTE for Pavan: real storage needs the actual file bytes, so this stays
    # multipart/form-data rather than the mock's JSON body. See ADR 0005 - the
    # real upload UI needs to send `upload` (file) + `comment` (text) as FormData.
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds {get_settings().max_upload_mb} MB limit.")
    if not data:
        raise HTTPException(422, "Empty file.")
    return data


def download_response(data: bytes, name: str, content_type: str, sha256: str, version: int) -> Response:
    # NOTE for Pavan: this returns raw file bytes (not the mock's JSON {content,
    # hash, verified}), because real content can be binary. The hash and version
    # travel as headers (X-Content-SHA256, X-File-Version) - read those instead of
    # a JSON body; the real integration in Phase 3 will need a small fetch-as-blob
    # change on your side. See ADR 0005.
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}",
            "X-Content-SHA256": sha256,
            "X-File-Version": str(version),
        },
    )


@router.post("", response_model=FileOut, status_code=201)
def upload_file(
    upload: UploadFile = FormFile(...),
    comment: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = read_upload(upload)
    f, _ = versioning.create_file(
        db, user, name=upload.filename or "untitled", content_type=upload.content_type or "", data=data, comment=comment
    )
    return file_out(db, user, f)


@router.get("", response_model=list[FileOut])
def list_files(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [file_out(db, user, f) for f in versioning.list_files(db, user)]


@router.get("/{file_id}", response_model=FileOut)
def get_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = versioning.get_file(db, file_id)
    permissions.require_access(db, user, f, PermissionLevel.read)
    return file_out(db, user, f)


@router.get("/{file_id}/download")
def download_current(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = versioning.get_file(db, file_id)
    data, v = versioning.read_version(db, f, user)
    return download_response(data, f.name, f.content_type, v.sha256, v.version_number)


@router.post("/{file_id}/verify", response_model=VerifyResult)
def verify_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Matches the mock's POST /files/:id/verify. Recomputes and compares the
    local hash on every call; chain_hash mirrors it until Sriganesh's ChainService
    is wired in (see ADR 0005) - at that point chain_hash comes from MSTScan and
    `verified` reflects an actual on-chain comparison."""
    f = versioning.get_file(db, file_id)
    permissions.require_access(db, user, f, PermissionLevel.read, content=True)
    v = versioning.current_version(db, f)
    if v is None:
        raise NotFound("File has no versions.")
    versioning.read_version(db, f, user, v.version_number)  # raises IntegrityViolation on mismatch
    return VerifyResult(
        file_id=f.id, local_hash=v.sha256, chain_hash=v.sha256, verified=True,
        timestamp=datetime.now(timezone.utc),
    )


@router.put("/{file_id}/protection", response_model=FileOut)
def set_protection(
    file_id: str, body: ProtectionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    protection.set_mode(db, f, user, body.protection)
    return file_out(db, user, f)


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    versioning.delete_file(db, versioning.get_file(db, file_id), user)
    return Response(status_code=204)
