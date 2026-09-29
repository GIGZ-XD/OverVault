"""ChainService interface — blockchain-agnostic abstraction layer.

This module defines the Protocol that every chain backend must satisfy.
Swap FakeChainService for RealChainService (MST EVM) by changing CHAIN_MODE;
no other backend code changes are needed.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------

TxStatus = Literal["pending", "confirmed", "failed"]


@dataclass
class TxResult:
    """Returned by every write operation.

    Attributes:
        tx_hash: Unique transaction identifier on the chain (or fake equivalent).
        status:  Current lifecycle state of the transaction.
        block_number: Block number where the transaction was mined.
        gas_used: Gas units consumed by the transaction.
        confirmations: Number of block confirmations.
        chain_id: EVM network chain ID.
        timestamp: Unix timestamp when the transaction occurred.
    """

    tx_hash: str
    status: TxStatus
    block_number: int | None = None
    gas_used: int | None = None
    confirmations: int | None = None
    chain_id: int | None = None
    timestamp: int | None = None


@dataclass
class AuditRecord:
    """A single audit-trail entry stored on (or mirrored from) the chain.

    Attributes:
        event_type: Semantic label, e.g. ``"upload"``, ``"approve"``.
        ref:        Subject identifier (file_id, version key, …).
        actor:      Address or user identifier that triggered the event.
        tx_hash:    Chain transaction that recorded this entry.
        timestamp:  Unix epoch (seconds) at the time of recording.
    """

    event_type: str
    ref: str
    actor: str
    tx_hash: str
    timestamp: int


# ---------------------------------------------------------------------------
# ChainService Protocol
# ---------------------------------------------------------------------------


class ChainService(Protocol):
    """Blockchain-agnostic interface for all on-chain operations in OverVault.

    Implementations must be structurally compatible with this Protocol
    (duck-typing).  No explicit inheritance is required.

    The four logical groups of operations:

    1. **Ownership**  — register file ownership on chain.
    2. **Permissions** — record access-control grants on chain.
    3. **Integrity**  — commit and verify document content hashes.
    4. **Audit**     — append-only event log and retrieval.
    """

    # -- Ownership -----------------------------------------------------------

    def register_ownership(
        self,
        file_id: str,
        owner_address: str,
        content_hash: str,
    ) -> TxResult:
        """Record an audit event (file ownership) on the blockchain.

        Args:
            file_id:       Internal OverVault file identifier.
            owner_address: Wallet address of the file owner.
            content_hash:  SHA-256 (or equivalent) hash of the file content.

        Returns:
            TxResult containing the transaction hash and confirmation status.
        """
        ...

    # -- Permissions ---------------------------------------------------------

    def record_permission(
        self,
        file_id: str,
        grantee: str,
        action: str,
        expiry: int | None,
    ) -> TxResult:
        """Store a permission grant as an on-chain audit event.

        Args:
            file_id: Internal OverVault file identifier.
            grantee: Wallet address (or user ID) receiving the permission.
            action:  Permission label, e.g. ``"read"``, ``"approve"``.
            expiry:  Unix timestamp after which the grant expires, or ``None``.

        Returns:
            TxResult containing the transaction hash and confirmation status.
        """
        ...

    # -- Integrity -----------------------------------------------------------

    def commit_hash(
        self,
        file_id: str,
        version: int,
        content_hash: str,
    ) -> TxResult:
        """Store a document integrity hash / reference on the blockchain.

        Args:
            file_id:      Internal OverVault file identifier.
            version:      Document version number being committed.
            content_hash: SHA-256 (or equivalent) hash of the versioned content.

        Returns:
            TxResult containing the transaction hash and confirmation status.
        """
        ...

    def verify_hash(
        self,
        file_id: str,
        version: int,
        content_hash: str,
    ) -> bool:
        """Verify whether a previously committed hash matches the given value.

        Args:
            file_id:      Internal OverVault file identifier.
            version:      Document version to check.
            content_hash: Hash to compare against the on-chain record.

        Returns:
            ``True`` if the stored hash matches ``content_hash``, else ``False``.
        """
        ...

    # -- Audit trail ---------------------------------------------------------

    def log_audit(
        self,
        event_type: str,
        ref: str,
        actor: str,
    ) -> TxResult:
        """Record a generic audit event on the blockchain.

        Args:
            event_type: Semantic event label (e.g. ``"download"``, ``"delete"``).
            ref:        Subject identifier the event relates to (e.g. file_id).
            actor:      Address or username that triggered the event.

        Returns:
            TxResult containing the transaction hash and confirmation status.
        """
        ...

    def get_audit_trail(self, file_id: str) -> list[AuditRecord]:
        """Retrieve the full audit trail for a file from the chain.

        Args:
            file_id: Internal OverVault file identifier.

        Returns:
            Ordered list of AuditRecord entries, oldest first.
        """
        ...

    # -- Transaction queries -------------------------------------------------

    def get_tx_status(self, tx_hash: str) -> TxStatus:
        """Retrieve transaction details / status for a given hash.

        Args:
            tx_hash: The transaction hash returned by a previous write call.

        Returns:
            Current TxStatus (``"pending"``, ``"confirmed"``, or ``"failed"``).
        """
        ...

    def verify_transaction(self, tx_hash: str) -> bool:
        """Verify whether a transaction exists and is valid on the chain.

        Args:
            tx_hash: The transaction hash to look up.

        Returns:
            ``True`` if the transaction is confirmed and valid, else ``False``.
        """
        ...

    def get_transaction_details(self, tx_hash: str) -> dict[str, Any]:
        """Retrieve full transaction metadata and confirmation status.

        Args:
            tx_hash: The transaction hash to look up.

        Returns:
            Dictionary containing tx_hash, status, block_number, gas_used,
            confirmations, chain_id, timestamp.
        """
        ...
