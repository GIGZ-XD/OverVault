"""RealChainService (CHAIN_MODE=testnet). Owner: Ganesh. Uses mst-sdk-python against MST Testnet."""
from app.chain.base import AuditRecord, TxResult, TxStatus


class RealChainService:
    def register_ownership(self, file_id, owner_address, content_hash) -> TxResult:
        raise NotImplementedError

    def record_permission(self, file_id, grantee, action, expiry) -> TxResult:
        raise NotImplementedError

    def commit_hash(self, file_id, version, content_hash) -> TxResult:
        raise NotImplementedError

    def log_audit(self, event_type, ref, actor) -> TxResult:
        raise NotImplementedError

    def get_tx_status(self, tx_hash) -> TxStatus:
        raise NotImplementedError

    def get_audit_trail(self, file_id) -> list[AuditRecord]:
        raise NotImplementedError

    def verify_hash(self, file_id, version, content_hash) -> bool:
        raise NotImplementedError
