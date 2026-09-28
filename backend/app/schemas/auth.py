from pydantic import BaseModel, ConfigDict

from app.models.user import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: Role
    wallet_address: str | None = None


class DevLoginRequest(BaseModel):
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class WalletNonceRequest(BaseModel):
    address: str


class WalletNonceResponse(BaseModel):
    nonce: str
    message: str


class WalletVerifyRequest(BaseModel):
    address: str
    nonce: str
    signature: str
