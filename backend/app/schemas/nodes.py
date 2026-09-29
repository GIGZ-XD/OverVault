"""Pydantic schemas for Decentralized Storage Node Network."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class StorageNodeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    hostname: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(..., min_length=7, max_length=45)
    region: str = Field(..., min_length=2, max_length=50)
    allocated_storage_gb: int = Field(..., gt=0)
    agent_version: str = "v1.2.0"


class StorageNodeCreate(StorageNodeBase):
    registration_token: str | None = None


class StorageNodeUpdateAllocation(BaseModel):
    allocated_storage_gb: int = Field(..., gt=0)


class StorageNodeOut(StorageNodeBase):
    id: str
    status: str  # online, offline, syncing, draining
    used_storage_gb: float
    health_score: int  # 0-100
    latency_ms: int
    uptime_percentage: float
    is_bootstrap: bool = False
    last_heartbeat: datetime
    created_at: datetime
    stored_chunks_count: int = 0

    model_config = {"from_attributes": True}


class ReplicationPolicy(BaseModel):
    replication_factor: int = Field(default=3, ge=1, le=7)
    min_write_quorum: int = Field(default=2, ge=1)
    auto_rebalance: bool = True
    heartbeat_interval_sec: int = 15
    encryption_mode: str = "AES-256-GCM"


class NodeRegistrationToken(BaseModel):
    token: str
    expires_at: datetime
    install_command: str
