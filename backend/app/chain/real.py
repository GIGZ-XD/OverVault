"""RealChainService — EVM adapter for OverVault (CHAIN_MODE=real).

Connects to a local Hardhat node (or any EVM-compatible RPC) via Web3.py.
All configuration is loaded from environment variables — no secrets are
hardcoded.

Required environment variables:
    EVM_RPC_URL                 — JSON-RPC endpoint  (e.g. http://127.0.0.1:8545)
    EVM_PRIVATE_KEY             — Hex private key for the signing wallet
    CONTRACT_ADDRESS_AUDIT      — Deployed Audit contract address
    CONTRACT_ADDRESS_INTEGRITY  — Deployed Integrity contract address
    CONTRACT_ADDRESS_OWNERSHIP  — Deployed Ownership contract address
    CONTRACT_ADDRESS_PERMISSION — Deployed Permission contract address

ABI loading:
    ABIs are read from contracts/artifacts/src/<Contract>.sol/<Contract>.json
    which are produced by `npx hardhat compile` and committed to the repo.
    This avoids any manual ABI transcription errors.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
import logging
import os
import time
from functools import cached_property
from pathlib import Path
from typing import Any

from web3 import Web3
from web3.exceptions import ContractLogicError
from web3.middleware import ExtraDataToPOAMiddleware

from app.chain.base import AuditRecord, TxResult, TxStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ABI directory — relative to this file so it works from any CWD
# ---------------------------------------------------------------------------

# backend/app/chain/real.py → up 3 levels → project root → contracts/artifacts
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ARTIFACTS_DIR = _PROJECT_ROOT / "contracts" / "artifacts" / "src"


def _load_abi(contract_name: str) -> list[dict]:
    """Load the ABI array from the Hardhat-compiled artifact JSON.

    Args:
        contract_name: Solidity contract name (e.g. ``"Audit"``).

    Returns:
        Parsed ABI list.

    Raises:
        FileNotFoundError: If the artifact has not been compiled yet.
        KeyError: If the artifact JSON is missing the ``"abi"`` key.
    """
    artifact_path = _ARTIFACTS_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.exists():
        raise FileNotFoundError(
            f"ABI artifact not found: {artifact_path}. "
            f"Run `npx hardhat compile` inside the contracts/ directory."
        )
    with artifact_path.open() as fh:
        artifact = json.load(fh)
    return artifact["abi"]


# ---------------------------------------------------------------------------
# Config helper — raises an informative error on missing vars
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    """Return the value of *name* from the environment or raise ``ValueError``.

    Args:
        name: Environment variable name.

    Returns:
        The non-empty string value.

    Raises:
        ValueError: If the variable is unset or empty.
    """
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(
            f"RealChainService: required environment variable '{name}' is not set. "
            f"Add it to your .env file or export it before starting the backend."
        )
    return value


# ---------------------------------------------------------------------------
# RealChainService
# ---------------------------------------------------------------------------


class RealChainService:
    """Web3.py-backed ChainService connecting to a local Hardhat (or any EVM) node.

    Implements the :class:`~app.chain.base.ChainService` Protocol.

    Instantiation validates all required environment variables and checks
    the RPC connection.  A ``ValueError`` is raised for missing config; a
    ``ConnectionError`` is raised if the node is unreachable.

    Thread safety: each instance caches the Web3 connection and signed-
    transaction account.  Use one instance per process (not per request).
    """

    def __init__(self) -> None:
        # ── Validate configuration ─────────────────────────────────────────
        rpc_url = _require_env("EVM_RPC_URL")
        private_key = _require_env("EVM_PRIVATE_KEY")
        self._addr_audit = Web3.to_checksum_address(_require_env("CONTRACT_ADDRESS_AUDIT"))
        self._addr_integrity = Web3.to_checksum_address(_require_env("CONTRACT_ADDRESS_INTEGRITY"))
        self._addr_ownership = Web3.to_checksum_address(_require_env("CONTRACT_ADDRESS_OWNERSHIP"))
        self._addr_permission = Web3.to_checksum_address(_require_env("CONTRACT_ADDRESS_PERMISSION"))

        # ── Connect to RPC ─────────────────────────────────────────────────
        self._w3 = Web3(Web3.HTTPProvider(rpc_url))
        # Inject PoA middleware (needed for Hardhat/Clique chains)
        self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self._w3.is_connected():
            raise ConnectionError(
                f"RealChainService: cannot connect to EVM node at '{rpc_url}'. "
                f"Make sure Hardhat is running (`npx hardhat node`)."
            )
        logger.info(
            "RealChainService connected — chainId=%s rpc=%s",
            self._w3.eth.chain_id,
            rpc_url,
        )

        # ── Signing account ────────────────────────────────────────────────
        self._account = self._w3.eth.account.from_key(private_key)
        logger.info("RealChainService signer: %s", self._account.address)

        # ── Load ABIs ──────────────────────────────────────────────────────
        self._abi_audit = _load_abi("Audit")
        self._abi_integrity = _load_abi("Integrity")
        self._abi_ownership = _load_abi("Ownership")
        self._abi_permission = _load_abi("Permission")

    # -----------------------------------------------------------------------
    # Contract accessors (lazy, cached per-instance)
    # -----------------------------------------------------------------------

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

    # -----------------------------------------------------------------------
    # Internal: send a signed transaction and wait for receipt
    # -----------------------------------------------------------------------

    def _send_tx(self, fn: Any) -> TxResult:
        """Build, sign, broadcast a contract call and return a TxResult.

        Args:
            fn: A Web3 contract function ready to be called
                (e.g. ``self._audit.functions.logAudit(...)``).

        Returns:
            :class:`~app.chain.base.TxResult` with the real transaction hash
            and a confirmed/failed status.

        Raises:
            ContractLogicError: Propagated if the transaction is reverted
                by the contract.
            Exception: Re-raised with context for any other unexpected error.
        """
        try:
            nonce = self._w3.eth.get_transaction_count(self._account.address)
            tx = fn.build_transaction(
                {
                    "from": self._account.address,
                    "nonce": nonce,
                    "gas": 500_000,
                    "gasPrice": self._w3.eth.gas_price,
                }
            )
            signed = self._account.sign_transaction(tx)
            tx_hash_bytes = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hash = tx_hash_bytes.hex()
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash

            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
            status: TxStatus = "confirmed" if receipt.status == 1 else "failed"
            logger.debug("tx %s — status=%s block=%s", tx_hash, status, receipt.blockNumber)
            return TxResult(tx_hash=tx_hash, status=status)

        except ContractLogicError as exc:
            logger.warning("Contract reverted: %s", exc)
            raise
        except Exception as exc:
            logger.error("Unexpected error sending transaction: %s", exc, exc_info=True)
            raise

    # -----------------------------------------------------------------------
    # Ownership
    # -----------------------------------------------------------------------

    def register_ownership(
        self,
        file_id: str,
        owner_address: str,
        content_hash: str,
    ) -> TxResult:
        """Register file ownership on-chain via ``Ownership.registerOwnership()``.

        The ``content_hash`` is anchored as the initial integrity hash
        (version 1) via a separate ``Integrity.commitHash()`` call so that
        ``verify_hash(file_id, 1, content_hash)`` returns ``True`` after
        registration.

        Args:
            file_id:       OverVault file identifier.
            owner_address: Ethereum address of the file owner.
            content_hash:  SHA-256 hash of the file content.

        Returns:
            :class:`~app.chain.base.TxResult` for the ownership transaction.
        """
        checksum_owner = Web3.to_checksum_address(owner_address)
        fn = self._ownership.functions.registerOwnership(file_id, checksum_owner)
        result = self._send_tx(fn)

        # Anchor initial hash as version 1 (mirrors FakeChainService behaviour)
        try:
            self.commit_hash(file_id, 1, content_hash)
        except Exception as exc:
            logger.warning(
                "register_ownership: could not anchor initial hash for %s: %s",
                file_id,
                exc,
            )

        return result

    # -----------------------------------------------------------------------
    # Permissions
    # -----------------------------------------------------------------------

    def record_permission(
        self,
        file_id: str,
        grantee: str,
        action: str,
        expiry: int | None,
    ) -> TxResult:
        """Record a permission grant via ``Permission.grantPermission()``.

        Args:
            file_id: OverVault file identifier.
            grantee: Ethereum address (or user id string) receiving the grant.
            action:  Permission label (e.g. ``"read"``).
            expiry:  Unix expiry timestamp or ``None`` for permanent grants.

        Returns:
            :class:`~app.chain.base.TxResult` for the permission transaction.
        """
        checksum_grantee = Web3.to_checksum_address(grantee)
        expiry_int = expiry if expiry is not None else 0
        fn = self._permission.functions.grantPermission(
            file_id, checksum_grantee, action, expiry_int
        )
        return self._send_tx(fn)

    # -----------------------------------------------------------------------
    # Integrity / hash commitment
    # -----------------------------------------------------------------------

    def commit_hash(
        self,
        file_id: str,
        version: int,
        content_hash: str,
    ) -> TxResult:
        """Commit a document integrity hash via ``Integrity.commitHash()``.

        Args:
            file_id:      OverVault file identifier.
            version:      Document version number.
            content_hash: SHA-256 hash of the versioned content.

        Returns:
            :class:`~app.chain.base.TxResult` for the integrity transaction.
        """
        fn = self._integrity.functions.commitHash(file_id, version, content_hash)
        return self._send_tx(fn)

    def verify_hash(
        self,
        file_id: str,
        version: int,
        content_hash: str,
    ) -> bool:
        """Verify a committed hash via ``Integrity.verifyHash()`` (read-only call).

        Args:
            file_id:      OverVault file identifier.
            version:      Document version number.
            content_hash: Hash to verify.

        Returns:
            ``True`` if the on-chain hash matches, ``False`` otherwise.
        """
        try:
            return bool(
                self._integrity.functions.verifyHash(file_id, version, content_hash).call()
            )
        except Exception as exc:
            logger.warning("verify_hash error for %s v%s: %s", file_id, version, exc)
            return False

    # -----------------------------------------------------------------------
    # Audit trail
    # -----------------------------------------------------------------------

    def log_audit(
        self,
        event_type: str,
        ref: str,
        actor: str,
    ) -> TxResult:
        """Record a generic audit event via ``Audit.logAudit()``.

        Args:
            event_type: Semantic event label (e.g. ``"FILE_UPLOADED"``).
            ref:        Subject identifier (file_id or entity key).
            actor:      Address or username that triggered the event.

        Returns:
            :class:`~app.chain.base.TxResult` for the audit transaction.
        """
        fn = self._audit.functions.logAudit(event_type, ref, actor)
        return self._send_tx(fn)

    def get_audit_trail(self, file_id: str) -> list[AuditRecord]:
        """Retrieve all audit entries for *file_id* from the chain.

        Calls ``Audit.getEntriesForRef(file_id)`` to get entry indices, then
        fetches each entry with ``Audit.getEntry(index)``.

        Args:
            file_id: OverVault file identifier (used as ``referenceId``).

        Returns:
            Ordered list of :class:`~app.chain.base.AuditRecord`, oldest first.
            Returns an empty list if no entries exist or on RPC error.
        """
        try:
            indices: list[int] = self._audit.functions.getEntriesForRef(file_id).call()
        except Exception as exc:
            logger.warning("get_audit_trail: getEntriesForRef failed for %s: %s", file_id, exc)
            return []

        records: list[AuditRecord] = []
        for idx in indices:
            try:
                event_type, reference_id, actor, timestamp = (
                    self._audit.functions.getEntry(idx).call()
                )
                # We need a tx_hash per record — log events carry it;
                # for simplicity we store a deterministic placeholder that
                # references the entry index.  Phase 6B can enrich this via
                # event log scanning.
                records.append(
                    AuditRecord(
                        event_type=event_type,
                        ref=reference_id,
                        actor=actor,
                        tx_hash=f"on-chain-entry-{idx}",
                        timestamp=int(timestamp),
                    )
                )
            except Exception as exc:
                logger.warning("get_audit_trail: getEntry(%s) failed: %s", idx, exc)
                continue

        return records

    # -----------------------------------------------------------------------
    # Transaction queries
    # -----------------------------------------------------------------------

    def get_tx_status(self, tx_hash: str) -> TxStatus:
        """Return the lifecycle status of *tx_hash*.

        Calls ``eth_getTransactionReceipt``.  If the receipt does not exist
        yet (transaction not yet mined), ``"pending"`` is returned.

        Args:
            tx_hash: Transaction hash returned by a previous write call.

        Returns:
            ``"confirmed"``, ``"pending"``, or ``"failed"``.
        """
        try:
            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
        except Exception:
            receipt = None

        if receipt is None:
            return "pending"
        if receipt.status == 1:
            return "confirmed"
        return "failed"

    def verify_transaction(self, tx_hash: str) -> bool:
        """Verify that *tx_hash* exists on-chain and is confirmed.

        Args:
            tx_hash: Transaction hash to look up.

        Returns:
            ``True`` if the transaction is confirmed, ``False`` otherwise.
        """
        return self.get_tx_status(tx_hash) == "confirmed"
