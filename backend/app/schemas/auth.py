"""Pydantic schemas for auth. Must match specs/openapi.yaml.

Owner: Pannaga (wallet-auth shapes); Vineeth (JWT response shape, UserOut).
NonceRequest/NonceResponse/WalletLoginRequest/DevLoginRequest field names and
the address-lowercasing validators are hers, verbatim - see her delivered
schemas/auth.py. TokenResponse adds `user` on top of her {access_token,
token_type} - additive only, so it doesn't conflict with the frozen shape
(Pavan's hooks already read response.user).
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.user import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: Role
    wallet_address: str | None = None


class NonceRequest(BaseModel):
    address: str

    @field_validator("address")
    @classmethod
    def normalize_address(cls, v: str) -> str:
        return v.strip().lower()


class NonceResponse(BaseModel):
    nonce: str
    message: str


class WalletLoginRequest(BaseModel):
    address: str
    signature: str  # no `nonce` field - the backend looks it up by address (wallet_auth.md 2.2)

    @field_validator("address")
    @classmethod
    def normalize_address(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut  # additive - not in her frozen shape, but harmless (extra JSON field)


class DevLoginRequest(BaseModel):
    """AUTH_MODE=dev only - skip wallet for a chosen test user, by id (not email)."""
    user_id: str


class UpdateProfileRequest(BaseModel):
    name: str


class RegisterRequest(BaseModel):
    name: str
    address: str | None = None
    role: Role = Role.employee

