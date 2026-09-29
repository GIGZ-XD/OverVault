"""FakeChainService (CHAIN_MODE=fake). Returns fake tx hashes so nobody waits on the real chain."""
import hashlib
import time
from app.chain.base import AuditRecord, TxResult, TxStatus


class FakeChainService:
    def __init__(self):
        self._audit: dict[str, list[AuditRecord]] = {}
        self._hashes: dict[tuple[str, int], str] = {}

    def _tx(self, *parts) -> TxResult:
        h = "0x" + hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:40]
        return TxResult(tx_hash=h, status="confirmed")

    def register_ownership(self, file_id, owner_address, content_hash):
        tx = self._tx("own", file_id, owner_address, content_hash)
        self._hashes[(file_id, 1)] = content_hash
        return tx

    def record_permission(self, file_id, grantee, action, expiry):
        return self._tx("perm", file_id, grantee, action, expiry)

    def commit_hash(self, file_id, version, content_hash):
        self._hashes[(file_id, version)] = content_hash
        return self._tx("hash", file_id, version, content_hash)

    def log_audit(self, event_type, ref, actor):
        tx = self._tx("audit", event_type, ref, actor)
        self._audit.setdefault(ref, []).append(
            AuditRecord(event_type, ref, actor, tx.tx_hash, int(time.time())))
        return tx

    def get_tx_status(self, tx_hash) -> TxStatus:
        return "confirmed"

    def get_audit_trail(self, file_id):
        return self._audit.get(file_id, [])

    def verify_hash(self, file_id, version, content_hash):
        return self._hashes.get((file_id, version)) == content_hash
