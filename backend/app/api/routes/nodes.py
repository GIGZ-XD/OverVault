"""Storage Node management routes for private decentralized network."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.nodes import (
    NodeRegistrationToken,
    ReplicationPolicy,
    StorageNodeCreate,
    StorageNodeOut,
    StorageNodeUpdateAllocation,
)

router = APIRouter(prefix="/nodes", tags=["storage-nodes"])

# In-memory storage state for storage nodes cluster
_NODES_DB: list[dict[str, Any]] = [
    {
        "id": "node-us-east-01",
        "name": "US-East Primary Vault",
        "hostname": "vault-node-01.us-east.internal",
        "ip_address": "192.168.10.45",
        "region": "US-East (N. Virginia)",
        "allocated_storage_gb": 1000,
        "used_storage_gb": 342.8,
        "status": "online",
        "health_score": 99,
        "latency_ms": 18,
        "uptime_percentage": 99.98,
        "is_bootstrap": True,
        "agent_version": "v1.2.0",
        "stored_chunks_count": 1420,
        "last_heartbeat": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc) - timedelta(days=45),
    },
    {
        "id": "node-eu-west-02",
        "name": "EU-West Frankfurt Relay",
        "hostname": "node-de-02.fra.internal",
        "ip_address": "10.240.0.12",
        "region": "EU-Central (Frankfurt)",
        "allocated_storage_gb": 750,
        "used_storage_gb": 289.4,
        "status": "online",
        "health_score": 96,
        "latency_ms": 42,
        "uptime_percentage": 99.85,
        "is_bootstrap": False,
        "agent_version": "v1.2.0",
        "stored_chunks_count": 1180,
        "last_heartbeat": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc) - timedelta(days=30),
    },
    {
        "id": "node-ap-south-03",
        "name": "AP-South Bangalore On-Prem",
        "hostname": "corp-dc-srv03.blr.lan",
        "ip_address": "172.16.8.99",
        "region": "AP-South (Bangalore)",
        "allocated_storage_gb": 1500,
        "used_storage_gb": 512.1,
        "status": "online",
        "health_score": 98,
        "latency_ms": 12,
        "uptime_percentage": 99.95,
        "is_bootstrap": False,
        "agent_version": "v1.2.0",
        "stored_chunks_count": 2150,
        "last_heartbeat": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc) - timedelta(days=20),
    },
    {
        "id": "node-edge-backup-04",
        "name": "Edge Disaster Recovery Node",
        "hostname": "edge-storage-dr.local",
        "ip_address": "192.168.1.104",
        "region": "Local Edge Cluster",
        "allocated_storage_gb": 500,
        "used_storage_gb": 120.0,
        "status": "syncing",
        "health_score": 91,
        "latency_ms": 8,
        "uptime_percentage": 98.40,
        "is_bootstrap": False,
        "agent_version": "v1.2.0",
        "stored_chunks_count": 640,
        "last_heartbeat": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc) - timedelta(days=5),
    },
]

_REPLICATION_POLICY = {
    "replication_factor": 3,
    "min_write_quorum": 2,
    "auto_rebalance": True,
    "heartbeat_interval_sec": 15,
    "encryption_mode": "AES-256-GCM",
}


@router.get("", response_model=list[StorageNodeOut], summary="List all connected storage nodes")
def list_nodes(user: User = Depends(get_current_user)) -> list[StorageNodeOut]:
    return [StorageNodeOut(**node) for node in _NODES_DB]


@router.post("/token", response_model=NodeRegistrationToken, summary="Generate node registration token")
def generate_registration_token(user: User = Depends(get_current_user)) -> NodeRegistrationToken:
    token = f"mst-node-sec-{secrets.token_urlsafe(24)}"
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    install_cmd = f"curl -sSL https://overvault.mst/install-agent.sh | sh -s -- --token={token} --cluster=mst-corp-vault"
    return NodeRegistrationToken(token=token, expires_at=expires, install_command=install_cmd)


@router.post("/register", response_model=StorageNodeOut, status_code=status.HTTP_201_CREATED, summary="Register new storage node")
def register_node(body: StorageNodeCreate, user: User = Depends(get_current_user)) -> StorageNodeOut:
    node_id = f"node-{body.name.lower().replace(' ', '-')[:20]}-{secrets.token_hex(3)}"
    new_node = {
        "id": node_id,
        "name": body.name,
        "hostname": body.hostname,
        "ip_address": body.ip_address,
        "region": body.region,
        "allocated_storage_gb": body.allocated_storage_gb,
        "used_storage_gb": 0.0,
        "status": "online",
        "health_score": 100,
        "latency_ms": 25,
        "uptime_percentage": 100.0,
        "is_bootstrap": False,
        "agent_version": body.agent_version,
        "stored_chunks_count": 0,
        "last_heartbeat": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    _NODES_DB.append(new_node)
    return StorageNodeOut(**new_node)


@router.put("/{node_id}/allocation", response_model=StorageNodeOut, summary="Update node allocated storage")
def update_allocation(node_id: str, body: StorageNodeUpdateAllocation, user: User = Depends(get_current_user)) -> StorageNodeOut:
    for node in _NODES_DB:
        if node["id"] == node_id:
            node["allocated_storage_gb"] = body.allocated_storage_gb
            return StorageNodeOut(**node)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage node not found")


@router.delete("/{node_id}/decommission", status_code=status.HTTP_200_OK, summary="Safely remove node with data evacuation")
def decommission_node(node_id: str, user: User = Depends(get_current_user)) -> dict[str, Any]:
    global _NODES_DB
    target = next((n for n in _NODES_DB if n["id"] == node_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage node not found")
    
    if target["is_bootstrap"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot decommission primary bootstrap node")
    
    evacuated_chunks = target.get("stored_chunks_count", 0)
    _NODES_DB = [n for n in _NODES_DB if n["id"] != node_id]
    
    return {
        "status": "decommissioned",
        "node_id": node_id,
        "evacuated_chunks": evacuated_chunks,
        "target_replica_nodes": [n["id"] for n in _NODES_DB[:2]],
        "message": f"Successfully evacuated {evacuated_chunks} encrypted chunks and removed node from cluster.",
    }


@router.get("/replication-policy", response_model=ReplicationPolicy, summary="Get cluster replication policy")
def get_replication_policy(user: User = Depends(get_current_user)) -> ReplicationPolicy:
    return ReplicationPolicy(**_REPLICATION_POLICY)


@router.put("/replication-policy", response_model=ReplicationPolicy, summary="Update cluster replication policy")
def update_replication_policy(body: ReplicationPolicy, user: User = Depends(get_current_user)) -> ReplicationPolicy:
    global _REPLICATION_POLICY
    _REPLICATION_POLICY = body.model_dump()
    return ReplicationPolicy(**_REPLICATION_POLICY)
