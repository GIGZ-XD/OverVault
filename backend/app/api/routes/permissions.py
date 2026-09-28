from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.permission import GrantRequest, PermissionOut, RevokeRequest
from app.services import permissions, versioning

router = APIRouter(tags=["permissions"])


@router.get("/files/{file_id}/permissions", response_model=list[PermissionOut])
def list_permissions(
    file_id: str, include_inactive: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    return permissions.list_for_file(db, f, user, include_inactive=include_inactive)


@router.post("/files/{file_id}/permissions", response_model=PermissionOut, status_code=201)
def grant_permission(
    file_id: str, body: GrantRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    return permissions.grant(
        db, f, user, grantee_id=body.user_id, level=body.level, expires_at=body.expires_at, signature=body.signature
    )


@router.post("/permissions/{permission_id}/revoke", response_model=PermissionOut)
def revoke_permission(
    permission_id: str,
    body: RevokeRequest | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return permissions.revoke(db, permission_id, user, signature=body.signature if body else None)
