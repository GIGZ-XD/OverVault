from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.file import ProtectionMode
from app.models.permission import PermissionLevel


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    content_type: str
    owner_id: str
    protection_mode: ProtectionMode
    current_version: int
    approved_version: int | None = None
    created_at: datetime
    updated_at: datetime
    my_access: PermissionLevel | None = None


class ProtectionUpdate(BaseModel):
    protection_mode: ProtectionMode


class DashboardSummary(BaseModel):
    total_files: int
    total_versions: int
    pending_approvals: int
    active_grants: int
    expiring_soon: int
    protected_files: int
    approved_files: int
