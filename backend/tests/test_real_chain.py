"""Phase 6A — Integration tests for RealChainService against a local Hardhat node.

Prerequisites (run once before this test suite):
    cd contracts
    npx hardhat node                          # keep running in a separate terminal
    npx hardhat run scripts/deploy.js         # captures deployed addresses

Required environment variables (set in backend/.env or shell):
    EVM_RPC_URL=http://127.0.0.1:8545
    EVM_PRIVATE_KEY=<first Hardhat test account private key>
    CONTRACT_ADDRESS_AUDIT=<deployed Audit address>
    CONTRACT_ADDRESS_INTEGRITY=<deployed Integrity address>
    CONTRACT_ADDRESS_OWNERSHIP=<deployed Ownership address>
    CONTRACT_ADDRESS_PERMISSION=<deployed Permission address>

The tests are marked with ``pytest.mark.real_chain`` so they can be skipped
in CI environments that don't have a Hardhat node running:

    pytest -m "not real_chain"   # skip real-chain tests
    pytest -m real_chain         # run only real-chain tests

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

import os
import uuid

import pytest

# ---------------------------------------------------------------------------
# Skip the whole module if the Hardhat node env vars are not set
# ---------------------------------------------------------------------------

_REQUIRED_ENV = [
    "EVM_RPC_URL",
    "EVM_PRIVATE_KEY",
    "CONTRACT_ADDRESS_AUDIT",
    "CONTRACT_ADDRESS_INTEGRITY",
    "CONTRACT_ADDRESS_OWNERSHIP",
    "CONTRACT_ADDRESS_PERMISSION",
]

_missing_env = [k for k in _REQUIRED_ENV if not os.environ.get(k)]

pytestmark = pytest.mark.real_chain

if _missing_env:
    pytest.skip(
        f"Skipping real_chain tests — missing env vars: {_missing_env}. "
        "Start Hardhat node, deploy contracts, and set env vars to run these tests.",
        allow_module_level=True,
    )


# ---------------------------------------------------------------------------
# Fixture — one RealChainService per test session (expensive to construct)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def chain():
    """Instantiate RealChainService once for the entire test module."""
    from app.chain.real import RealChainService

    svc = RealChainService()
    return svc


@pytest.fixture
def file_id() -> str:
    """Return a unique file identifier for each test to avoid state collisions."""
    return f"test-file-{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# 1. Ownership registration
# ---------------------------------------------------------------------------


class TestRegisterOwnership:
    def test_returns_tx_result(self, chain, file_id):
        """register_ownership() returns a confirmed TxResult."""
        result = chain.register_ownership(
            file_id=file_id,
            owner_address=os.environ["EVM_PRIVATE_KEY_ADDRESS"]
            if os.environ.get("EVM_PRIVATE_KEY_ADDRESS")
            else _signer_address(),
            content_hash="0xdeadbeef" * 8,
        )
        assert result.tx_hash.startswith("0x"), "tx_hash must be a hex string"
        assert result.status == "confirmed"

    def test_tx_is_verifiable(self, chain, file_id):
        """Transaction hash returned by register_ownership() can be verified."""
        result = chain.register_ownership(
            file_id=file_id,
            owner_address=_signer_address(),
            content_hash="abc" * 21,
        )
        assert chain.verify_transaction(result.tx_hash) is True

    def test_anchors_initial_hash(self, chain, file_id):
        """register_ownership() anchors content_hash as version 1."""
        content_hash = "sha256-" + uuid.uuid4().hex
        chain.register_ownership(
            file_id=file_id,
            owner_address=_signer_address(),
            content_hash=content_hash,
        )
        # Version 1 should be verifiable immediately
        assert chain.verify_hash(file_id, 1, content_hash) is True
        assert chain.verify_hash(file_id, 1, "wrong-hash") is False


# ---------------------------------------------------------------------------
# 2. Hash commitment & verification
# ---------------------------------------------------------------------------


class TestHashCommitAndVerify:
    def test_commit_and_verify(self, chain, file_id):
        """commit_hash() stores hash; verify_hash() confirms it."""
        content_hash = "sha256-" + uuid.uuid4().hex
        result = chain.commit_hash(
            file_id=file_id, version=1, content_hash=content_hash
        )

        assert result.status == "confirmed"
        assert chain.verify_hash(file_id, 1, content_hash) is True

    def test_wrong_hash_fails(self, chain, file_id):
        """verify_hash() returns False for a different hash on the same version."""
        content_hash = "sha256-" + uuid.uuid4().hex
        chain.commit_hash(file_id=file_id, version=1, content_hash=content_hash)

        assert chain.verify_hash(file_id, 1, "completely-wrong-hash") is False

    def test_unregistered_version_fails(self, chain, file_id):
        """verify_hash() returns False for a version that was never committed."""
        assert chain.verify_hash(file_id, 999, "any-hash") is False

    def test_multiple_versions(self, chain, file_id):
        """Different versions of the same file can be committed independently."""
        hash_v1 = "sha256-v1-" + uuid.uuid4().hex
        hash_v2 = "sha256-v2-" + uuid.uuid4().hex

        chain.commit_hash(file_id=file_id, version=1, content_hash=hash_v1)
        chain.commit_hash(file_id=file_id, version=2, content_hash=hash_v2)

        assert chain.verify_hash(file_id, 1, hash_v1) is True
        assert chain.verify_hash(file_id, 2, hash_v2) is True
        # Cross-version check must fail
        assert chain.verify_hash(file_id, 1, hash_v2) is False


# ---------------------------------------------------------------------------
# 3. Audit logging & retrieval
# ---------------------------------------------------------------------------


class TestAuditLogging:
    def test_log_audit_returns_confirmed(self, chain, file_id):
        """log_audit() returns a confirmed TxResult."""
        result = chain.log_audit(
            event_type="FILE_UPLOADED",
            ref=file_id,
            actor="sriganesh@overvault.io",
        )
        assert result.status == "confirmed"
        assert result.tx_hash.startswith("0x")

    def test_audit_trail_grows(self, chain, file_id):
        """get_audit_trail() returns all logged events for a file, in order."""
        chain.log_audit("FILE_UPLOADED", file_id, "user-a")
        chain.log_audit("FILE_APPROVED", file_id, "user-b")

        trail = chain.get_audit_trail(file_id)
        assert len(trail) >= 2, f"Expected ≥2 records, got {len(trail)}"

        event_types = [r.event_type for r in trail]
        assert "FILE_UPLOADED" in event_types
        assert "FILE_APPROVED" in event_types

    def test_audit_record_fields(self, chain, file_id):
        """AuditRecord returned by get_audit_trail() has the correct fields."""
        chain.log_audit("FILE_DELETED", file_id, "admin")
        trail = chain.get_audit_trail(file_id)

        record = trail[-1]
        assert record.event_type == "FILE_DELETED"
        assert record.ref == file_id
        assert record.actor == "admin"
        assert isinstance(record.timestamp, int)
        assert record.timestamp > 0

    def test_empty_trail_for_unknown_file(self, chain):
        """get_audit_trail() returns [] for a file_id with no logged events."""
        unknown_id = "no-events-" + uuid.uuid4().hex
        trail = chain.get_audit_trail(unknown_id)
        assert trail == []


# ---------------------------------------------------------------------------
# 4. Transaction verification
# ---------------------------------------------------------------------------


class TestTransactionVerification:
    def test_verify_known_tx(self, chain, file_id):
        """verify_transaction() returns True for a transaction we sent."""
        result = chain.log_audit("VERIFY_TEST", file_id, "tester")
        assert chain.verify_transaction(result.tx_hash) is True

    def test_get_tx_status_confirmed(self, chain, file_id):
        """get_tx_status() returns 'confirmed' for a mined transaction."""
        result = chain.log_audit("STATUS_TEST", file_id, "tester")
        assert chain.get_tx_status(result.tx_hash) == "confirmed"

    def test_get_tx_status_pending_unknown(self, chain):
        """get_tx_status() returns 'pending' for a hash that doesn't exist."""
        fake_hash = "0x" + "0" * 64
        status = chain.get_tx_status(fake_hash)
        assert status == "pending"

    def test_verify_transaction_unknown(self, chain):
        """verify_transaction() returns False for an unknown tx hash."""
        fake_hash = "0x" + "1" * 64
        assert chain.verify_transaction(fake_hash) is False


# ---------------------------------------------------------------------------
# 5. Permission recording
# ---------------------------------------------------------------------------


class TestRecordPermission:
    def test_record_permission_confirmed(self, chain, file_id):
        """record_permission() returns a confirmed TxResult."""
        result = chain.record_permission(
            file_id=file_id,
            grantee=_signer_address(),
            action="read",
            expiry=None,
        )
        assert result.status == "confirmed"
        assert result.tx_hash.startswith("0x")

    def test_record_permission_with_expiry(self, chain, file_id):
        """record_permission() works correctly with an explicit expiry timestamp."""
        import time as _time

        future_expiry = int(_time.time()) + 86400  # 24 h from now
        result = chain.record_permission(
            file_id=file_id,
            grantee=_signer_address(),
            action="approve",
            expiry=future_expiry,
        )
        assert result.status == "confirmed"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _signer_address() -> str:
    """Derive the public address from EVM_PRIVATE_KEY."""
    from web3 import Web3

    pk = os.environ["EVM_PRIVATE_KEY"]
    acct = Web3().eth.account.from_key(pk)
    return acct.address
