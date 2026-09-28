"""Frozen ChainService interface. Owner: Ganesh.
Keep identical to backend/app/chain/base.py (checked in CI)."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, Protocol

TxStatus = Literal["pending", "confirmed", "failed"]

@dataclass
class TxResult:
    tx_hash: str
    status: TxStatus

@dataclass
class AuditRecord:
    event_type: str
    ref: str
    actor: str
    tx_hash: str
    timestamp: int

class ChainService(Protocol):
    def register_ownership(self, file_id: str, owner_address: str, content_hash: str) -> TxResult: ...
    def record_permission(self, file_id: str, grantee: str, action: str, expiry: int | None) -> TxResult: ...
    def commit_hash(self, file_id: str, version: int, content_hash: str) -> TxResult: ...
    def log_audit(self, event_type: str, ref: str, actor: str) -> TxResult: ...
    def get_tx_status(self, tx_hash: str) -> TxStatus: ...
    def get_audit_trail(self, file_id: str) -> list[AuditRecord]: ...
    def verify_hash(self, file_id: str, version: int, content_hash: str) -> bool: ...
