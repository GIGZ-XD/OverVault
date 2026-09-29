import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token
from app.db import get_db
from app.models.user import Role, User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    if creds is None:
        raise unauthorized
    try:
        payload = decode_access_token(creds.credentials)
    except pyjwt.PyJWTError:
        raise unauthorized
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role.")
        return user

    return checker


def get_chain_service():
    from app.chain import get_chain_service as _get_chain
    return _get_chain()

