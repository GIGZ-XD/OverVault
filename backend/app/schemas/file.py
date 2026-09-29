from datetime import datetime

from pydantic import BaseModel

from app.models.file import ProtectionMode
from app.models.permission import PermissionLevel


class FileOut(BaseModel):
    """Field names/shape match Pavan's frontend mock (handlers.ts) exactly for the
    top-level fields; extra fields are additive so nothing he reads breaks."""

    id: str
    name: str
    owner: str  # == File.owner_id
    size: int  # current version's size_bytes
    protection: ProtectionMode  # == File.protection_mode
    verification: str  # "verified" | "unverified" - self-consistency only until
    #                      Sriganesh's chain layer lands; see ADR 0005.
    hash: str  # current version's sha256
    ownership_tx: str | None = None  # populated once the chain layer is wired in

    # Additive fields Pavan's mock doesn't have but the real app needs later.
    content_type: str
    current_version: int
    approved_version: int | None = None
    created_at: datetime
    updated_at: datetime
    my_access: PermissionLevel | None = None


class ProtectionUpdate(BaseModel):
    protection: ProtectionMode  # was protection_mode - renamed to match the mock


class VerifyResult(BaseModel):
    """Matches POST /files/{id}/verify. Returns on-chain verification status against MST Testnet."""

    file_id: str
    local_hash: str
    chain_hash: str
    verified: bool
    status: str = "VALID"
    source: str = "MST Testnet"
    tx_hash: str | None = None
    timestamp: datetime



class DashboardSummary(BaseModel):
    total_files: int
    verified_files: int
    pending_approvals: int
    active_permissions: int
    integrity_score: str
    blockchain_status: str
