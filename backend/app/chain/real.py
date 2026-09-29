"""RealChainService — MST Testnet EVM implementation for OverVault (CHAIN_MODE=real).

Connects to the MST Testnet RPC (Chain ID 91562037) via Web3.py.
All configuration is loaded from environment variables (.env) — no secrets hardcoded.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
import logging
import os
import threading
from functools import cached_property
from pathlib import Path
from typing import Any

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.chain.base import AuditRecord, TxResult, TxStatus

logger = logging.getLogger("overvault.chain.real")

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ARTIFACTS_DIR = _PROJECT_ROOT / "contracts" / "artifacts" / "src"
_DEPLOYED_TESTNET_JSON = _PROJECT_ROOT / "contracts" / "deployed.testnet.json"

# Embedded ABIs as fallback
_FALLBACK_ABIS = {
    "Audit": [
        {
            "inputs": [
                {"name": "eventType", "type": "string"},
                {"name": "referenceId", "type": "string"},
                {"name": "actor", "type": "string"}
            ],
            "name": "logAudit",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"name": "index", "type": "uint256"}],
            "name": "getEntry",
            "outputs": [
                {"name": "eventType", "type": "string"},
                {"name": "referenceId", "type": "string"},
                {"name": "actor", "type": "string"},
                {"name": "timestamp", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "referenceId", "type": "string"}],
            "name": "getEntriesForRef",
            "outputs": [{"name": "", "type": "uint256[]"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "totalEntries",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ],
    "Integrity": [
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "version", "type": "uint256"},
                {"name": "contentHash", "type": "string"}
            ],
            "name": "commitHash",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "version", "type": "uint256"},
                {"name": "contentHash", "type": "string"}
            ],
            "name": "verifyHash",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "version", "type": "uint256"}
            ],
            "name": "getHash",
            "outputs": [{"name": "", "type": "string"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "fileId", "type": "string"}],
            "name": "getLatestVersion",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "version", "type": "uint256"}
            ],
            "name": "isCommitted",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        }
    ],
    "Ownership": [
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "owner", "type": "address"}
            ],
            "name": "registerOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "newOwner", "type": "address"}
            ],
            "name": "transferOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"name": "fileId", "type": "string"}],
            "name": "getOwner",
            "outputs": [{"name": "", "type": "address"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "fileId", "type": "string"}],
            "name": "isRegistered",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        }
    ],
    "Permission": [
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "grantee", "type": "address"},
                {"name": "action", "type": "string"},
                {"name": "expiry", "type": "uint256"}
            ],
            "name": "grantPermission",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "grantee", "type": "address"},
                {"name": "action", "type": "string"}
            ],
            "name": "checkPermission",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "grantee", "type": "address"},
                {"name": "action", "type": "string"}
            ],
            "name": "getPermission",
            "outputs": [
                {"name": "exists", "type": "bool"},
                {"name": "expiry", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"name": "fileId", "type": "string"},
                {"name": "grantee", "type": "address"},
                {"name": "action", "type": "string"}
            ],
            "name": "revokePermission",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
}


def _load_abi(contract_name: str) -> list[dict]:
    """Load ABI array from artifact file or fallback."""
    artifact_path = _ARTIFACTS_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    if artifact_path.exists():
        try:
            with artifact_path.open() as fh:
                artifact = json.load(fh)
                if "abi" in artifact:
                    return artifact["abi"]
        except Exception as e:
            logger.warning("Could not read ABI from %s: %s; using embedded ABI", artifact_path, e)
    return _FALLBACK_ABIS.get(contract_name, [])


def _resolve_contract_address(name: str, explicit: str | None = None) -> str:
    """Resolve a contract address from explicit arg, env var, or deployed.testnet.json."""
    if explicit and Web3.is_address(explicit):
        return Web3.to_checksum_address(explicit)
    env_val = os.environ.get(f"CONTRACT_ADDRESS_{name.upper()}", "").strip()
    if env_val and Web3.is_address(env_val):
        return Web3.to_checksum_address(env_val)
    if _DEPLOYED_TESTNET_JSON.exists():
        try:
            with _DEPLOYED_TESTNET_JSON.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
                addr = data.get("contracts", {}).get(name.lower(), {}).get("address", "")
                if addr and Web3.is_address(addr):
                    return Web3.to_checksum_address(addr)
        except Exception:
            pass
    raise ValueError(
        f"RealChainService: required contract address for '{name}' not found. "
        f"Set CONTRACT_ADDRESS_{name.upper()} in your environment or populate {_DEPLOYED_TESTNET_JSON}."
    )


class RealChainService:
    """MST Testnet EVM implementation of the ChainService Protocol.

    Handles real on-chain writes for:
    - Integrity hash commitments (Integrity contract)
    - Ownership registration (Ownership contract)
    - Permission grants & revocations (Permission contract)
    - Append-only audit logging (Audit contract)
    """

    def __init__(
        self,
        rpc_url: str | None = None,
        private_key: str | None = None,
        contract_address_audit: str | None = None,
        contract_address_integrity: str | None = None,
        contract_address_ownership: str | None = None,
        contract_address_permission: str | None = None,
    ) -> None:
        self._tx_lock = threading.Lock()

        # 1. Resolve RPC URL
        self.rpc_url = (
            rpc_url
            or os.environ.get("MST_RPC_URL", "").strip()
            or os.environ.get("EVM_RPC_URL", "").strip()
            or "https://testnetrpc.mstblockchain.com"
        )

        # 2. Resolve Private Key
        self._raw_private_key = (
            private_key
            or os.environ.get("MST_BACKEND_SIGNER_KEY", "").strip()
            or os.environ.get("MST_PRIVATE_KEY", "").strip()
            or os.environ.get("EVM_PRIVATE_KEY", "").strip()
        )

        # 3. Resolve Contract Addresses
        self._addr_audit = _resolve_contract_address("audit", contract_address_audit)
        self._addr_integrity = _resolve_contract_address("integrity", contract_address_integrity)
        self._addr_ownership = _resolve_contract_address("ownership", contract_address_ownership)
        self._addr_permission = _resolve_contract_address("permission", contract_address_permission)

        # 4. Connect to Web3 provider
        self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self._w3.is_connected():
            raise ConnectionError(
                f"RealChainService: cannot connect to MST RPC at '{self.rpc_url}'. "
                "Ensure node is reachable."
            )

        self.chain_id = self._w3.eth.chain_id

        # 5. Signing account
        self._account = (
            self._w3.eth.account.from_key(self._raw_private_key)
            if self._raw_private_key
            else None
        )

        # 6. Load ABIs
        self._abi_audit = _load_abi("Audit")
        self._abi_integrity = _load_abi("Integrity")
        self._abi_ownership = _load_abi("Ownership")
        self._abi_permission = _load_abi("Permission")

        logger.info(
            "RealChainService initialized: rpc=%s chainId=%s signer=%s",
            self.rpc_url,
            self.chain_id,
            self._account.address if self._account else "None (read-only)",
        )

    @property
    def signer_address(self) -> str | None:
        return self._account.address if self._account else None

    # Contract instances
    @cached_property
    def _audit(self) -> Any:
        return self._w3.eth.contract(address=self._addr_audit, abi=self._abi_audit)

    @cached_property
    def _integrity(self) -> Any:
        return self._w3.eth.contract(address=self._addr_integrity, abi=self._abi_integrity)

    @cached_property
    def _ownership(self) -> Any:
        return self._w3.eth.contract(address=self._addr_ownership, abi=self._abi_ownership)

    @cached_property
    def _permission(self) -> Any:
        return self._w3.eth.contract(address=self._addr_permission, abi=self._abi_permission)

    def _safe_address(self, val: str | None) -> str:
        """Coerce an identifier or user ID into a valid EVM checksum address."""
        if val and Web3.is_address(val):
            return Web3.to_checksum_address(val)
        if val and isinstance(val, str):
            # Derive deterministic 20-byte address from string
            h = Web3.keccak(text=val)[-20:].hex()
            return Web3.to_checksum_address("0x" + h)
        if self._account:
            return self._account.address
        return Web3.to_checksum_address("0x0000000000000000000000000000000000000001")

    def _send_tx(self, fn: Any, gas_limit: int = 400_000) -> TxResult:
        """Sign and broadcast a transaction, wait for confirmation receipt, and return TxResult."""
        if not self._account:
            raise ValueError(
                "RealChainService: transaction signing requires a private key. "
                "Set MST_PRIVATE_KEY or MST_BACKEND_SIGNER_KEY in .env."
            )

        with self._tx_lock:
            try:
                nonce = self._w3.eth.get_transaction_count(self._account.address, "pending")
                gas_price = self._w3.eth.gas_price
                if gas_price == 0:
                    gas_price = 1_000_000_000  # 1 Gwei fallback

                tx_data = fn.build_transaction(
                    {
                        "from": self._account.address,
                        "nonce": nonce,
                        "gas": gas_limit,
                        "gasPrice": gas_price,
                        "chainId": self.chain_id,
                    }
                )
                signed = self._account.sign_transaction(tx_data)
                tx_hash_bytes = self._w3.eth.send_raw_transaction(signed.raw_transaction)
                tx_hex = tx_hash_bytes.hex()
                if not tx_hex.startswith("0x"):
                    tx_hex = "0x" + tx_hex

                receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=90)
                status: TxStatus = "confirmed" if receipt.status == 1 else "failed"
                logger.info(
                    "MST tx confirmed: %s (status=%s, block=%s)",
                    tx_hex,
                    status,
                    receipt.blockNumber,
                )
                return TxResult(tx_hash=tx_hex, status=status)
            except Exception as e:
                logger.exception("Failed to send transaction on MST Testnet: %s", e)
                raise

    # -----------------------------------------------------------------------
    # 1. Integrity Contract
    # -----------------------------------------------------------------------

    def commit_hash(self, file_id: str, version: int, content_hash: str) -> TxResult:
        """Call Integrity smart contract to commit (file_id, version, content_hash)."""
        # If already committed and matches, avoid revert and return confirmed
        try:
            if self.verify_hash(file_id, version, content_hash):
                logger.info(
                    "Hash for %s v%s is already committed and verified on-chain",
                    file_id,
                    version,
                )
                return TxResult(tx_hash="0x" + "0" * 64, status="confirmed")
        except Exception:
            pass

        fn = self._integrity.functions.commitHash(str(file_id), int(version), str(content_hash))
        return self._send_tx(fn)

    def verify_hash(self, file_id: str, version: int, content_hash: str) -> bool:
        """Query MST Integrity contract to verify whether content_hash matches."""
        try:
            return bool(
                self._integrity.functions.verifyHash(
                    str(file_id), int(version), str(content_hash)
                ).call()
            )
        except Exception as exc:
            logger.warning("verify_hash call error for %s v%s: %s", file_id, version, exc)
            return False

    def get_hash(self, file_id: str, version: int) -> str:
        """Retrieve committed hash from Integrity contract."""
        try:
            return str(self._integrity.functions.getHash(str(file_id), int(version)).call())
        except Exception as exc:
            logger.warning("get_hash error for %s v%s: %s", file_id, version, exc)
            return ""

    # -----------------------------------------------------------------------
    # 2. Ownership Contract
    # -----------------------------------------------------------------------

    def register_ownership(
        self, file_id: str, owner_address: str, content_hash: str
    ) -> TxResult:
        """Register file ownership on Ownership contract and anchor hash v1 on Integrity contract."""
        owner_addr = self._safe_address(owner_address)

        # Check if already registered
        try:
            is_reg = bool(self._ownership.functions.isRegistered(str(file_id)).call())
            if is_reg:
                logger.info("Ownership for %s already registered on-chain", file_id)
                # Ensure integrity hash v1 is committed
                if content_hash:
                    try:
                        self.commit_hash(file_id, 1, content_hash)
                    except Exception:
                        pass
                return TxResult(tx_hash="0x" + "0" * 64, status="confirmed")
        except Exception:
            pass

        fn = self._ownership.functions.registerOwnership(str(file_id), owner_addr)
        res = self._send_tx(fn)

        # Also commit version 1 hash to Integrity contract
        if content_hash:
            try:
                self.commit_hash(file_id, 1, content_hash)
            except Exception as e:
                logger.warning("Could not anchor initial hash during register_ownership: %s", e)

        return res

    # -----------------------------------------------------------------------
    # 3. Permission Contract
    # -----------------------------------------------------------------------

    def record_permission(
        self, file_id: str, grantee: str, action: str, expiry: int | None
    ) -> TxResult:
        """Record permission grant on Permission contract."""
        grantee_addr = self._safe_address(grantee)
        expiry_ts = int(expiry) if expiry is not None else 0
        fn = self._permission.functions.grantPermission(
            str(file_id), grantee_addr, str(action), expiry_ts
        )
        return self._send_tx(fn)

    # -----------------------------------------------------------------------
    # 4. Audit Contract
    # -----------------------------------------------------------------------

    def log_audit(self, event_type: str, ref: str, actor: str) -> TxResult:
        """Record immutable audit event on Audit contract."""
        fn = self._audit.functions.logAudit(str(event_type), str(ref), str(actor))
        return self._send_tx(fn)

    def get_audit_trail(self, file_id: str) -> list[AuditRecord]:
        """Fetch all audit trail entries for a file reference from Audit contract."""
        try:
            indices: list[int] = self._audit.functions.getEntriesForRef(str(file_id)).call()
        except Exception as exc:
            logger.warning("get_audit_trail: getEntriesForRef failed for %s: %s", file_id, exc)
            return []

        records: list[AuditRecord] = []
        for idx in indices:
            try:
                event_type, reference_id, actor, timestamp = (
                    self._audit.functions.getEntry(idx).call()
                )
                records.append(
                    AuditRecord(
                        event_type=event_type,
                        ref=reference_id,
                        actor=actor,
                        tx_hash=f"on-chain-audit-{idx}",
                        timestamp=int(timestamp),
                    )
                )
            except Exception as exc:
                logger.warning("get_audit_trail: getEntry(%s) failed: %s", idx, exc)
                continue

        return records

    # -----------------------------------------------------------------------
    # 5. Transaction status & verification
    # -----------------------------------------------------------------------

    def get_tx_status(self, tx_hash: str) -> TxStatus:
        """Check transaction confirmation status on MST Testnet."""
        try:
            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
            if receipt is None:
                return "pending"
            return "confirmed" if receipt.status == 1 else "failed"
        except Exception:
            return "pending"

    def verify_transaction(self, tx_hash: str) -> bool:
        """Check if transaction exists and is confirmed."""
        return self.get_tx_status(tx_hash) == "confirmed"
