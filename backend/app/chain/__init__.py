from app.chain.base import AuditRecord, ChainService, TxResult, TxStatus
from app.chain.fake import FakeChainService
from app.chain.real import RealChainService

_chain_service_instance = None


def get_chain_service() -> ChainService:
    global _chain_service_instance
    if _chain_service_instance is None:
        from app.config import get_settings

        s = get_settings()
        if s.chain_mode.lower() in ("real", "testnet", "mst"):
            _chain_service_instance = RealChainService(
                rpc_url=s.mst_rpc_url,
                private_key=s.get_effective_private_key(),
                contract_address_audit=s.contract_address_audit,
                contract_address_integrity=s.contract_address_integrity,
                contract_address_ownership=s.contract_address_ownership,
                contract_address_permission=s.contract_address_permission,
            )
        else:
            _chain_service_instance = FakeChainService()
    return _chain_service_instance


__all__ = [
    "AuditRecord",
    "ChainService",
    "FakeChainService",
    "RealChainService",
    "TxResult",
    "TxStatus",
    "get_chain_service",
]
