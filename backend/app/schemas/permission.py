from datetime import datetime

from pydantic import BaseModel

from app.models.permission import PermissionLevel


class GrantRequest(BaseModel):
    grantee: str  # was user_id - renamed to match the mock
    permission: PermissionLevel  # was level - renamed to match the mock
    expires_at: datetime | None = None
    signature: str | None = None  # wallet signature, recorded in the audit event


class PermissionOut(BaseModel):
    id: str
    file_id: str
    grantee: str  # == Permission.user_id
    permission: PermissionLevel  # == Permission.level
    status: str  # "active" | "revoked" | "expired" - computed, matches the mock
    expires_at: datetime | None = None

    # Additive fields the mock doesn't return but the app needs later.
    granted_by: str
    revoked_at: datetime | None = None
    revoked_reason: str | None = None
    created_at: datetime
    tx_hash: str | None = None
