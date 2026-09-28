"""FakeChainService — in-memory blockchain for development and testing.

Set ``CHAIN_MODE=fake`` (the default for local dev) to use this backend.
No network calls are made; all state is held in instance dictionaries and
reset when the process exits.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import hashlib
import time

from app.chain.base import AuditRecord, TxResult, TxStatus

# ---------------------------------------------------------------------------
# Transaction record stored internally
# ---------------------------------------------------------------------------

_TX_TYPE_OWNERSHIP = "ownership"
_TX_TYPE_PERMISSION = "permission"
_TX_TYPE_HASH = "hash_commitment"
_TX_TYPE_AUDIT = "audit_event"


class FakeChainService:
    """Fully in-memory ChainService implementation.

    Generates deterministic fake transaction hashes derived from the input
    arguments so that identical calls always produce the same hash, which
    makes test assertions simple and predictable.

    Thread safety: not guaranteed.  Use one instance per test / request.
    """

    def __init__(self) -> None:
        # tx_hash -> full transaction dict
        self._transactions: dict[str, dict] = {}
        # (file_id, version) -> content_hash
        self._hashes: dict[tuple[str, int], str] = {}
        # file_id -> list[AuditRecord]
        self._audit: dict[str, list[AuditRecord]] = {}

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _make_tx_hash(self, *parts: object) -> str:
        """Derive a deterministic fake tx hash from the given parts."""
        raw = "|".join(map(str, parts)).encode()
        return "0x" + hashlib.sha256(raw).hexdigest()[:40]

    def _store_tx(self, tx_hash: str, tx_type: str, data: dict) -> TxResult:
        """Persist a fake transaction and return a TxResult."""
        self._transactions[tx_hash] = {
            "tx_hash": tx_hash,
            "status": "confirmed",
            "type": tx_type,
            "data": data,
            "timestamp": int(time.time()),
        }
        return TxResult(tx_hash=tx_hash, status="confirmed")

    # -----------------------------------------------------------------------
    # Ownership
    # -----------------------------------------------------------------------

    def register_ownership(
        self,
        file_id: str,
        owner_address: str,
        content_hash: str,
    ) -> TxResult:
        """Record an audit event (file ownership) on the fake chain.

        Stores the initial content hash as version 1 so that
        ``verify_hash(file_id, 1, content_hash)`` returns ``True`` immediately.

        Args:
            file_id:       Internal OverVault file identifier.
            owner_address: Wallet address of the file owner.
            content_hash:  Content hash to anchor on chain.

        Returns:
            TxResult with a confirmed fake transaction hash.
        """
        tx_hash = self._make_tx_hash(_TX_TYPE_OWNERSHIP, file_id, owner_address, content_hash)
        self._hashes[(file_id, 1)] = content_hash
        return self._store_tx(
            tx_hash,
            _TX_TYPE_OWNERSHIP,
            {"file_id": file_id, "owner": owner_address, "content_hash": content_hash},
        )

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
        """Store a permission grant as an on-chain audit event.

        Args:
            file_id: Internal OverVault file identifier.
            grantee: Address or user ID receiving the grant.
            action:  Permission label (e.g. ``"read"``).
            expiry:  Unix expiry timestamp, or ``None`` for permanent grants.

        Returns:
            TxResult with a confirmed fake transaction hash.
        """
        tx_hash = self._make_tx_hash(_TX_TYPE_PERMISSION, file_id, grantee, action, expiry)
        return self._store_tx(
            tx_hash,
            _TX_TYPE_PERMISSION,
            {"file_id": file_id, "grantee": grantee, "action": action, "expiry": expiry},
        )

    # -----------------------------------------------------------------------
    # Integrity / hash commitment
    # -----------------------------------------------------------------------

    def commit_hash(
        self,
        file_id: str,
        version: int,
        content_hash: str,
    ) -> TxResult:
        """Store a document integrity hash / reference on the fake chain.

        Args:
            file_id:      Internal OverVault file identifier.
            version:      Document version number being committed.
            content_hash: Hash to store for this version.

        Returns:
            TxResult with a confirmed fake transaction hash.
        """
        tx_hash = self._make_tx_hash(_TX_TYPE_HASH, file_id, version, content_hash)
        self._hashes[(file_id, version)] = content_hash
        return self._store_tx(
            tx_hash,
            _TX_TYPE_HASH,
            {"file_id": file_id, "version": version, "content_hash": content_hash},
        )

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
            content_hash: Hash to compare against the stored record.

        Returns:
            ``True`` if stored hash matches ``content_hash``, else ``False``.
        """
        return self._hashes.get((file_id, version)) == content_hash

    # -----------------------------------------------------------------------
    # Audit trail
    # -----------------------------------------------------------------------

    def log_audit(
        self,
        event_type: str,
        ref: str,
        actor: str,
    ) -> TxResult:
        """Record a generic audit event on the fake chain.

        Creates a fake blockchain transaction and appends an AuditRecord
        to the in-memory audit trail for ``ref`` (typically a file_id).

        Args:
            event_type: Semantic event label (e.g. ``"download"``).
            ref:        Subject identifier the event relates to.
            actor:      Address or username that triggered the event.

        Returns:
            TxResult with a confirmed fake transaction hash.
        """
        tx_hash = self._make_tx_hash(_TX_TYPE_AUDIT, event_type, ref, actor, int(time.time()))
        result = self._store_tx(
            tx_hash,
            _TX_TYPE_AUDIT,
            {"event_type": event_type, "ref": ref, "actor": actor},
        )
        record = AuditRecord(
            event_type=event_type,
            ref=ref,
            actor=actor,
            tx_hash=tx_hash,
            timestamp=int(time.time()),
        )
        self._audit.setdefault(ref, []).append(record)
        return result

    def get_audit_trail(self, file_id: str) -> list[AuditRecord]:
        """Retrieve the full audit trail for a file.

        Args:
            file_id: Internal OverVault file identifier.

        Returns:
            Ordered list of AuditRecord entries, oldest first.
            Returns an empty list if no events have been recorded.
        """
        return self._audit.get(file_id, [])

    # -----------------------------------------------------------------------
    # Transaction queries
    # -----------------------------------------------------------------------

    def get_tx_status(self, tx_hash: str) -> TxStatus:
        """Retrieve transaction details / status for a given hash.

        The fake chain always returns ``"confirmed"`` for known transactions
        and ``"failed"`` for unknown ones (simulating a not-found response).

        Args:
            tx_hash: The transaction hash to look up.

        Returns:
            ``"confirmed"`` if the transaction exists, otherwise ``"failed"``.
        """
        if tx_hash in self._transactions:
            return "confirmed"
        return "failed"

    def verify_transaction(self, tx_hash: str) -> bool:
        """Verify whether a transaction exists and is valid on the fake chain.

        Args:
            tx_hash: The transaction hash to verify.

        Returns:
            ``True`` if the transaction is known and confirmed, else ``False``.
        """
        return self.get_tx_status(tx_hash) == "confirmed"
