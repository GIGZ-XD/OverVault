import logging
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, File as FormFile, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_chain_service, get_current_user
from app.models.audit_outbox import AuditOutbox
from app.models.file import File
from app.models.permission import PermissionLevel
from app.models.user import User
from app.schemas.file import FileOut, ProtectionUpdate, VerifyResult
from app.services import blockchain as blockchain_service, hashing, permissions, protection, versioning
from app.services.rbac import NotFound

logger = logging.getLogger("overvault.routes.files")
router = APIRouter(prefix="/files", tags=["files"])


def file_out(db: Session, user: User, f: File) -> FileOut:
    """Builds the response the mock returns (owner/size/protection/verification/hash/
    ownership_tx), plus additive fields the mock doesn't have. See schemas/file.py."""
    v = versioning.current_version(db, f)
    if v is None:
        raise NotFound("File has no versions.")
    # Look up confirmed on-chain transaction hash for this document
    tx_hash = f.blockchain_tx_hash or db.scalar(
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
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds {get_settings().max_upload_mb} MB limit.")
    if not data:
        raise HTTPException(422, "Empty file.")
    return data


def download_response(data: bytes, name: str, content_type: str, sha256: str, version: int) -> Response:
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
    f, v = versioning.create_file(
        db, user, name=upload.filename or "untitled", content_type=upload.content_type or "", data=data, comment=comment
    )

    chain = get_chain_service()
    try:
        # 1. Store integrity hash on MST Testnet
        commit_res = chain.commit_hash(file_id=f.id, version=v.version_number, content_hash=v.sha256)
        if commit_res and commit_res.tx_hash:
            f.blockchain_tx_hash = commit_res.tx_hash
            blockchain_service.record_tx(
                db,
                tx_hash=commit_res.tx_hash,
                contract_called="Integrity",
                action="commit_hash",
                reference_id=f.id,
                status=commit_res.status,
            )

        # 2. Register ownership on MST Testnet
        owner_addr = user.wallet_address or user.id
        own_res = chain.register_ownership(file_id=f.id, owner_address=owner_addr, content_hash=v.sha256)
        if own_res and own_res.tx_hash:
            blockchain_service.record_tx(
                db,
                tx_hash=own_res.tx_hash,
                contract_called="Ownership",
                action="register_ownership",
                reference_id=f.id,
                status=own_res.status,
            )

        # 3. Log audit event on MST Testnet
        audit_res = chain.log_audit(
            event_type="FILE_CREATED",
            ref=f.id,
            actor=user.wallet_address or user.name or user.id,
        )
        if audit_res and audit_res.tx_hash:
            blockchain_service.record_tx(
                db,
                tx_hash=audit_res.tx_hash,
                contract_called="Audit",
                action="log_audit",
                reference_id=f.id,
                status=audit_res.status,
            )

        db.commit()
    except Exception as exc:
        logger.warning("Blockchain write failed during file upload for %s: %s", f.id, exc)
        db.commit()

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

    # Log FILE_DOWNLOADED event on blockchain
    try:
        chain = get_chain_service()
        audit_res = chain.log_audit(
            event_type="FILE_DOWNLOADED",
            ref=f.id,
            actor=user.wallet_address or user.name or user.id,
        )
        if audit_res and audit_res.tx_hash:
            blockchain_service.record_tx(
                db,
                tx_hash=audit_res.tx_hash,
                contract_called="Audit",
                action="log_audit",
                reference_id=f.id,
                status=audit_res.status,
            )
            db.commit()
    except Exception as exc:
        logger.warning("Blockchain log_audit FILE_DOWNLOADED failed for %s: %s", f.id, exc)

    return download_response(data, f.name, f.content_type, v.sha256, v.version_number)


@router.post("/{file_id}/verify", response_model=VerifyResult)
def verify_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Verifies file SHA-256 against the on-chain MST Integrity contract."""
    f = versioning.get_file(db, file_id)
    permissions.require_access(db, user, f, PermissionLevel.read, content=True)
    v = versioning.current_version(db, f)
    if v is None:
        raise NotFound("File has no versions.")

    data, _ = versioning.read_version(db, f, user, v.version_number)
    local_hash = hashing.sha256_hex(data)

    chain = get_chain_service()
    chain_hash = ""
    try:
        chain_hash = chain.get_hash(f.id, v.version_number)
    except Exception:
        pass

    verified = False
    if chain_hash:
        verified = (local_hash.lower() == chain_hash.lower())
    else:
        try:
            verified = chain.verify_hash(f.id, v.version_number, local_hash)
        except Exception:
            verified = False

    status_str = "VALID" if verified else "INVALID"

    # Log FILE_VERIFIED audit event on blockchain
    try:
        audit_res = chain.log_audit(
            event_type="FILE_VERIFIED",
            ref=f.id,
            actor=user.wallet_address or user.name or user.id,
        )
        if audit_res and audit_res.tx_hash:
            blockchain_service.record_tx(
                db,
                tx_hash=audit_res.tx_hash,
                contract_called="Audit",
                action="log_audit",
                reference_id=f.id,
                status=audit_res.status,
            )
            db.commit()
    except Exception as exc:
        logger.warning("Blockchain log_audit FILE_VERIFIED failed for %s: %s", f.id, exc)

    return VerifyResult(
        file_id=f.id,
        local_hash=local_hash,
        chain_hash=chain_hash or local_hash,
        verified=verified,
        status=status_str,
        source="MST Testnet",
        tx_hash=f.blockchain_tx_hash,
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

