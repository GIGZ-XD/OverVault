from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserOut
from app.services import rbac
from app.services.rbac import NotFound

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rbac.require_capability(user, "user.list")
    return list(db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.name)))


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user_id != user.id:
        rbac.require_capability(user, "user.list")
    target = db.get(User, user_id)
    if target is None:
        raise NotFound("User not found.")
    return target
