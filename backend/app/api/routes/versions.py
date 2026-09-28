from fastapi import APIRouter, Depends, File as FormFile, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.routes.files import download_response, read_upload
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.version import RollbackRequest, VersionOut
from app.services import versioning

router = APIRouter(prefix="/files/{file_id}/versions", tags=["versions"])


@router.get("", response_model=list[VersionOut])
def list_versions(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return versioning.list_versions(db, versioning.get_file(db, file_id), user)


@router.post("", response_model=VersionOut, status_code=201)
def upload_version(
    file_id: str,
    upload: UploadFile = FormFile(...),
    comment: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    f = versioning.get_file(db, file_id)
    return versioning.add_version(db, f, user, read_upload(upload), comment)


@router.get("/{number}/download")
def download_version(
    file_id: str, number: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    data, v = versioning.read_version(db, f, user, number)
    return download_response(data, f.name, f.content_type, v.sha256, v.version_number)


@router.post("/{number}/rollback", response_model=VersionOut, status_code=201)
def rollback(
    file_id: str,
    number: int,
    body: RollbackRequest | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    f = versioning.get_file(db, file_id)
    return versioning.rollback(db, f, user, number, body.comment if body else "")
