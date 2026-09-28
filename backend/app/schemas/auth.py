"""Pydantic schemas for auth. Must match specs/openapi.yaml.

Owner: Pannaga (wallet-auth shapes); Vineeth (JWT response shape).
"""
from __future__ import annotations

from pydantic import BaseModel, field_validator


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
    signature: str

    @field_validator("address")
    @classmethod
    def normalize_address(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    """JWT response shape — produced by Vineeth's JWT layer."""
    access_token: str
    token_type: str = "bearer"


class DevLoginRequest(BaseModel):
    """AUTH_MODE=dev only — skip wallet for a chosen test user."""
    user_id: str
