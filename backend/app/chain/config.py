"""Blockchain configuration management for MST Testnet and Mainnet environments.

Provides centralized environment loading, validation, and secret masking.
Supports both MST_* and EVM_* environment variable naming conventions for
seamless backwards compatibility.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

ChainNetworkMode = Literal["testnet", "mainnet", "local", "fake"]


def mask_secret(secret: str | None, visible_chars: int = 4) -> str:
    """Mask a sensitive key or secret, revealing only leading and trailing characters."""
    if not secret:
        return "<not-set>"
    clean = secret.strip()
    if len(clean) <= visible_chars * 2:
        return "***"
    return f"{clean[:visible_chars]}...{clean[-visible_chars:]}"


def _get_env_with_fallback(primary: str, *fallbacks: str, default: str | None = None) -> str | None:
    """Read primary environment variable, trying fallbacks in order."""
    val = os.environ.get(primary, "").strip()
    if val:
        return val
    for fb in fallbacks:
        val = os.environ.get(fb, "").strip()
        if val:
            return val
    return default


@dataclass(frozen=True)
class MSTChainConfig:
    """Immutable production configuration container for MST EVM chain services."""

    rpc_url: str
    chain_id: int
    private_key: str
    contract_audit: str
    contract_integrity: str
    contract_ownership: str
    contract_permission: str
    tx_timeout_seconds: int = 120
    batch_size: int = 100
    poll_interval_seconds: float = 5.0

    @classmethod
    def from_env(cls) -> MSTChainConfig:
        """Load and validate configuration from environment variables.

        Raises:
            ValueError: If any required blockchain parameter is missing.
        """
        rpc_url = _get_env_with_fallback("MST_RPC_URL", "EVM_RPC_URL")
        if not rpc_url:
            raise ValueError("MSTChainConfig: 'MST_RPC_URL' or 'EVM_RPC_URL' is required.")

        chain_id_raw = _get_env_with_fallback("MST_CHAIN_ID", "EVM_CHAIN_ID", default="1337")
        try:
            chain_id = int(chain_id_raw) if chain_id_raw else 1337
        except ValueError as exc:
            raise ValueError(f"MSTChainConfig: Invalid chain_id {chain_id_raw!r}") from exc

        private_key = _get_env_with_fallback("MST_PRIVATE_KEY", "EVM_PRIVATE_KEY")
        if not private_key:
            raise ValueError("MSTChainConfig: 'MST_PRIVATE_KEY' or 'EVM_PRIVATE_KEY' is required.")

        addr_audit = _get_env_with_fallback("CONTRACT_AUDIT_ADDRESS", "CONTRACT_ADDRESS_AUDIT")
        if not addr_audit:
            raise ValueError("MSTChainConfig: 'CONTRACT_AUDIT_ADDRESS' or 'CONTRACT_ADDRESS_AUDIT' is required.")

        addr_integrity = _get_env_with_fallback("CONTRACT_INTEGRITY_ADDRESS", "CONTRACT_ADDRESS_INTEGRITY")
        if not addr_integrity:
            raise ValueError("MSTChainConfig: 'CONTRACT_INTEGRITY_ADDRESS' or 'CONTRACT_ADDRESS_INTEGRITY' is required.")

        addr_ownership = _get_env_with_fallback("CONTRACT_OWNERSHIP_ADDRESS", "CONTRACT_ADDRESS_OWNERSHIP")
        if not addr_ownership:
            raise ValueError("MSTChainConfig: 'CONTRACT_OWNERSHIP_ADDRESS' or 'CONTRACT_ADDRESS_OWNERSHIP' is required.")

        addr_permission = _get_env_with_fallback("CONTRACT_PERMISSION_ADDRESS", "CONTRACT_ADDRESS_PERMISSION")
        if not addr_permission:
            raise ValueError("MSTChainConfig: 'CONTRACT_PERMISSION_ADDRESS' or 'CONTRACT_ADDRESS_PERMISSION' is required.")

        tx_timeout = int(_get_env_with_fallback("TX_TIMEOUT_SECONDS", default="120") or "120")
        batch_size = int(_get_env_with_fallback("OUTBOX_BATCH_SIZE", default="100") or "100")
        poll_interval = float(_get_env_with_fallback("OUTBOX_POLL_INTERVAL", default="5.0") or "5.0")

        return cls(
            rpc_url=rpc_url,
            chain_id=chain_id,
            private_key=private_key,
            contract_audit=addr_audit,
            contract_integrity=addr_integrity,
            contract_ownership=addr_ownership,
            contract_permission=addr_permission,
            tx_timeout_seconds=tx_timeout,
            batch_size=batch_size,
            poll_interval_seconds=poll_interval,
        )

    def to_safe_summary(self) -> dict[str, str | int | float]:
        """Return a dictionary safe for logging (with private keys masked)."""
        return {
            "rpc_url": self.rpc_url,
            "chain_id": self.chain_id,
            "private_key": mask_secret(self.private_key),
            "contract_audit": self.contract_audit,
            "contract_integrity": self.contract_integrity,
            "contract_ownership": self.contract_ownership,
            "contract_permission": self.contract_permission,
            "tx_timeout_seconds": self.tx_timeout_seconds,
            "batch_size": self.batch_size,
            "poll_interval_seconds": self.poll_interval_seconds,
        }
