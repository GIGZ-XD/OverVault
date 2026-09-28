from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import dev_auth
from app.auth.jwt import create_access_token
from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models.user import Role, User
from app.schemas.auth import (
    DevLoginRequest,
    TokenResponse,
    UserOut,
    WalletNonceRequest,
    WalletNonceResponse,
    WalletVerifyRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/dev-login", response_model=TokenResponse)
def dev_login(body: DevLoginRequest, db: Session = Depends(get_db)):
    return _token(dev_auth.dev_login(db, body.email))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


def _wallet():
    """Pannaga's module (app/auth/wallet_auth). Imported lazily so the backend runs without it."""
    try:
        from app.auth.wallet_auth import nonce, verify
    except ImportError:
        raise HTTPException(501, "Wallet auth module not installed yet.")
    return nonce, verify


@router.post("/nonce", response_model=WalletNonceResponse)  # was /wallet/nonce - path matches the mock
def wallet_nonce(body: WalletNonceRequest):
    nonce, _ = _wallet()
    return nonce.issue_nonce(body.address)  # ASSUMED: -> {"nonce": str, "message": str}


@router.post("/wallet-login", response_model=TokenResponse)  # was /wallet/verify - path matches the mock
def wallet_verify(body: WalletVerifyRequest, db: Session = Depends(get_db)):
    _, verify = _wallet()
    try:
        # ASSUMED: -> verified wallet address (str); raises ValueError on a bad signature/nonce
        address = verify.verify_login(body.address, body.nonce, body.signature)
    except ValueError as exc:
        raise HTTPException(401, str(exc))
    user = db.scalar(select(User).where(User.wallet_address == address.lower()))
    if user is None:
        if not get_settings().wallet_auto_provision:
            raise HTTPException(403, "This wallet is not linked to any user.")
        user = User(email=f"{address.lower()}@wallet.local", name=f"Wallet {address[:8]}",
                    role=Role.employee, wallet_address=address.lower())
        db.add(user)
        db.commit()
    return _token(user)
