"""Auth routes: dev-login, nonce, wallet-login.

Ownership:
  - /auth/nonce and /auth/wallet-login -> Pannaga (wallet_auth), wired to
    Vineeth's DB via the injected user_lookup (app/auth/user_lookup.py).
  - /auth/dev-login -> Vineeth, using Pannaga's shared fixture ids (u1-u4).
  - JWT creation -> Vineeth (app/auth/jwt.py).

Error response shape ({"detail": {"code": ..., "message": ...}}) matches
Pannaga's delivered route exactly, per wallet_auth.md section 5's per-code
error table. This differs from the flat {"detail": str, "code": str} shape
the rest of the app's DomainError handler uses - flagged for the team to
reconcile into one convention later; not changed here since it's her
delivered, spec-matching design for these two endpoints specifically.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import dev_auth
from app.auth.jwt import create_access_token
from app.auth.user_lookup import db_wallet_lookup
from app.auth.wallet_auth import (
    AddressNotFoundError,
    InvalidSignatureError,
    NonceExpiredError,
    create_nonce,
    verify_wallet_login,
)
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    DevLoginRequest,
    NonceRequest,
    NonceResponse,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
    WalletLoginRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/nonce", response_model=NonceResponse)
def request_nonce(body: NonceRequest) -> NonceResponse:
    """Issue a one-time nonce for the given wallet address. Client passes
    `message` verbatim to wallet.signMessage(). Expires in 5 minutes."""
    result = create_nonce(body.address)
    return NonceResponse(nonce=result["nonce"], message=result["message"])


@router.post("/wallet-login", response_model=TokenResponse)
def wallet_login(body: WalletLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Verify a wallet signature and issue a JWT. No auto-provisioning: an
    unregistered address is a 403 (wallet_auth.md section 9)."""
    try:
        identity = verify_wallet_login(
            address=body.address,
            signature=body.signature,
            user_lookup=db_wallet_lookup(db),  # real DB lookup, not her placeholder fixture
        )
    except NonceExpiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "nonce_expired", "message": str(exc)}
        ) from exc
    except InvalidSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_signature", "message": str(exc)}
        ) from exc
    except AddressNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail={"code": "address_not_found", "message": str(exc)}
        ) from exc

    user = db.get(User, identity.user_id)
    if user is None or not user.is_active:  # lookup succeeded but the row vanished/deactivated mid-request
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "address_not_found", "message": "Linked user is no longer active."},
        )
    return _token(user)


@router.post("/dev-login", response_model=TokenResponse)
def dev_login(body: DevLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """AUTH_MODE=dev only - skip wallet, get a token for a seeded test user by id."""
    return _token(dev_auth.dev_login(db, body.user_id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(body: UpdateProfileRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> User:
    """Update display name for the current authenticated user session."""
    if body.name and body.name.strip():
        user.name = body.name.strip()
        db.commit()
        db.refresh(user)
    return user

