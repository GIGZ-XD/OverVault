from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.permission import Permission
from app.models.user import User
from app.schemas.permission import GrantRequest, PermissionOut
from app.services import permissions, versioning

router = APIRouter(tags=["permissions"])


def permission_out(p: Permission) -> PermissionOut:
    if p.revoked_at is not None:
        status = "revoked"
    elif p.expires_at is not None and p.expires_at <= datetime.now(timezone.utc):
        status = "expired"
    else:
        status = "active"
    return PermissionOut(
        id=p.id,
        file_id=p.file_id,
        grantee=p.user_id,
        permission=p.level,
        status=status,
        expires_at=p.expires_at,
        granted_by=p.granted_by,
        revoked_at=p.revoked_at,
        revoked_reason=p.revoked_reason,
        created_at=p.created_at,
    )


@router.get("/files/{file_id}/permissions", response_model=list[PermissionOut])
def list_permissions(
    file_id: str, include_inactive: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    return [permission_out(p) for p in permissions.list_for_file(db, f, user, include_inactive=include_inactive)]


@router.post("/files/{file_id}/permissions", response_model=PermissionOut, status_code=201)
def grant_permission(
    file_id: str, body: GrantRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    p = permissions.grant(
        db, f, user, grantee_id=body.grantee, level=body.permission, expires_at=body.expires_at, signature=body.signature
    )
    return permission_out(p)


@router.delete("/permissions/{permission_id}", status_code=204)
def revoke_permission(permission_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Method/path match the mock (DELETE, not POST .../revoke). Wallet signatures
    # on a revoke have nowhere to travel on a bodyless DELETE; add one back as a
    # query param if Pannaga's signing flow needs it recorded here.
    permissions.revoke(db, permission_id, user)
    from fastapi import Response

    return Response(status_code=204)
