from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.permission import PermissionLevel


class GrantRequest(BaseModel):
    user_id: str
    level: PermissionLevel
    expires_at: datetime | None = None
    signature: str | None = None  # wallet signature, recorded in the audit event


class RevokeRequest(BaseModel):
    signature: str | None = None


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    file_id: str
    user_id: str
    level: PermissionLevel
    granted_by: str
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    revoked_reason: str | None = None
    created_at: datetime
