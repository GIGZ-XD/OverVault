from urllib.parse import quote

from fastapi import APIRouter, Depends, File as FormFile, Form, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models.file import File
from app.models.user import User
from app.schemas.file import FileOut, ProtectionUpdate
from app.services import permissions, protection, versioning

router = APIRouter(prefix="/files", tags=["files"])


def file_out(db: Session, user: User, f: File) -> FileOut:
    out = FileOut.model_validate(f)
    out.my_access = permissions.effective_level(db, user, f)
    return out


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
    from app.models.permission import PermissionLevel

    permissions.require_access(db, user, f, PermissionLevel.read)
    return file_out(db, user, f)


@router.get("/{file_id}/download")
def download_current(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = versioning.get_file(db, file_id)
    data, v = versioning.read_version(db, f, user)
    return download_response(data, f.name, f.content_type, v.sha256, v.version_number)


@router.patch("/{file_id}/protection", response_model=FileOut)
def set_protection(
    file_id: str, body: ProtectionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    protection.set_mode(db, f, user, body.protection_mode)
    return file_out(db, user, f)


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    versioning.delete_file(db, versioning.get_file(db, file_id), user)
    return Response(status_code=204)
