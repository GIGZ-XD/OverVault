"""Auth routes: dev-login, nonce, wallet-login.

Ownership:
  - /auth/nonce and /auth/wallet-login → Pannaga (wallet_auth)
  - /auth/dev-login → Pannaga (dev_auth scaffold) / Vineeth (JWT issuance)
  - JWT creation → Vineeth (app/auth/jwt.py)

The routes call wallet_auth functions and return the verified identity.
Vineeth's JWT layer sits between verify_wallet_login() and the token response.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.auth.wallet_auth import (
    create_nonce,
    verify_wallet_login,
    NonceExpiredError,
    InvalidSignatureError,
    AddressNotFoundError,
)
from app.auth.dev_auth import get_dev_user
from app.schemas.auth import (
    NonceRequest,
    NonceResponse,
    WalletLoginRequest,
    TokenResponse,
    DevLoginRequest,
)
from app.config import settings

router = APIRouter()


@router.post("/auth/nonce", response_model=NonceResponse, tags=["auth"])
async def request_nonce(body: NonceRequest) -> NonceResponse:
    """Issue a one-time nonce for the given wallet address.

    The client must pass ``message`` verbatim to ``wallet.signMessage()``.
    Nonce expires in 5 minutes.
    """
    result = create_nonce(body.address)
    return NonceResponse(nonce=result["nonce"], message=result["message"])


@router.post("/auth/wallet-login", response_model=TokenResponse, tags=["auth"])
async def wallet_login(body: WalletLoginRequest) -> TokenResponse:
    """Verify a wallet signature and issue a JWT.

    1. Recovers the signer from the EIP-191 signature.
    2. Validates the address matches the stored nonce.
    3. Links address to user identity.
    4. Returns a JWT (TODO: Vineeth implements JWT creation in app/auth/jwt.py).
    """
    try:
        identity = verify_wallet_login(
            address=body.address,
            signature=body.signature,
        )
    except NonceExpiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "nonce_expired", "message": str(exc)},
        ) from exc
    except InvalidSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_signature", "message": str(exc)},
        ) from exc
    except AddressNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "address_not_found", "message": str(exc)},
        ) from exc

    # TODO (Vineeth): replace the placeholder below with a real JWT from app/auth/jwt.py
    # Expected call: token = create_jwt(sub=identity.user_id, wallet=identity.address, role=identity.role)
    placeholder_token = f"placeholder.jwt.for.{identity.user_id}"
    return TokenResponse(access_token=placeholder_token)


@router.post("/auth/dev-login", response_model=TokenResponse, tags=["auth"])
async def dev_login(body: DevLoginRequest) -> TokenResponse:
    """AUTH_MODE=dev only — skip wallet, get token for a test user.

    Returns 403 in wallet mode.
    """
    if settings.auth_mode != "dev":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "dev_login_disabled", "message": "AUTH_MODE is not dev"},
        )
    user = get_dev_user(body.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "user_not_found", "message": f"No dev user {body.user_id}"},
        )
    # TODO (Vineeth): replace placeholder with real JWT
    placeholder_token = f"placeholder.jwt.for.{user['user_id']}"
    return TokenResponse(access_token=placeholder_token)
