"""Phase 5 Enterprise Validation Tests.

Validates:
- MST mainnet / testnet configuration loading and secret masking
- Blockchain monitoring metrics (pending, failed, confirmation, gas)
- Outbox worker production optimizations (batching, timeout handling, duplicate protection)
- Enhanced transaction verification API (/transaction/{tx_hash}) with contract and event mapping

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.chain.config import MSTChainConfig, mask_secret
from app.chain.fake import FakeChainService
from app.deps import get_chain_service
from app.main import app
from app.models.audit_outbox import AuditOutbox, Base
from app.services import blockchain_monitor, outbox as outbox_service
from app.workers.outbox_worker import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_POLL_INTERVAL,
    TX_TIMEOUT_SECONDS,
    process_pending_events,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """In-memory SQLite session."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


@pytest.fixture()
def chain():
    return FakeChainService()


@pytest.fixture()
def client(chain: FakeChainService):
    app.dependency_overrides[get_chain_service] = lambda: chain
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Task 1 & 2: Mainnet Config & Secret Masking
# ---------------------------------------------------------------------------


def test_mst_chain_config_from_env():
    env_vars = {
        "MST_RPC_URL": "https://rpc.mainnet.mst.xyz",
        "MST_CHAIN_ID": "1338",
        "MST_PRIVATE_KEY": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "CONTRACT_AUDIT_ADDRESS": "0x1111111111111111111111111111111111111111",
        "CONTRACT_INTEGRITY_ADDRESS": "0x2222222222222222222222222222222222222222",
        "CONTRACT_OWNERSHIP_ADDRESS": "0x3333333333333333333333333333333333333333",
        "CONTRACT_PERMISSION_ADDRESS": "0x4444444444444444444444444444444444444444",
    }
    with patch.dict(os.environ, env_vars, clear=True):
        cfg = MSTChainConfig.from_env()
        assert cfg.rpc_url == "https://rpc.mainnet.mst.xyz"
        assert cfg.chain_id == 1338
        assert cfg.is_mainnet is True
        assert cfg.get_masked_private_key().startswith("0x12")
        assert cfg.get_masked_private_key().endswith("cdef")


def test_mst_chain_config_missing_required():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="is required"):
            MSTChainConfig.from_env()


def test_mask_secret_helper():
    assert mask_secret(None) == "<not-set>"
    assert mask_secret("short") == "***"
    masked = mask_secret("0x0123456789abcdef0123456789abcdef")
    assert masked.startswith("0x01")
    assert masked.endswith("cdef")
    assert "..." in masked


# ---------------------------------------------------------------------------
# Task 4: Blockchain Monitoring Service
# ---------------------------------------------------------------------------


def test_blockchain_monitor_metrics(db: Session):
    # Seed outbox events
    now = datetime.now(UTC)
    e_pending = AuditOutbox(
        event_type="audit_log",
        reference_id="f1",
        actor="user1",
        payload='{"event_type":"download","ref":"f1","actor":"user1"}',
        status="pending",
        retry_count=1,
        created_at=now - timedelta(seconds=30),
    )
    e_failed = AuditOutbox(
        event_type="hash_commitment",
        reference_id="f2",
        actor="user2",
        payload='{"file_id":"f2","version":1,"content_hash":"0xabc"}',
        status="failed",
        retry_count=5,
        last_error="RPC timeout",
        created_at=now - timedelta(seconds=20),
    )
    e_confirmed1 = AuditOutbox(
        event_type="ownership",
        reference_id="f3",
        actor="user3",
        payload='{"file_id":"f3","owner_address":"0x3333","content_hash":"0xdef"}',
        status="confirmed",
        tx_hash="0xabc1",
        retry_count=0,
        created_at=now - timedelta(seconds=15),
        processed_at=now,
    )
    e_confirmed2 = AuditOutbox(
        event_type="permission",
        reference_id="f4",
        actor="user4",
        payload='{"file_id":"f4","grantee_address":"0x4444","role":"VIEWER"}',
        status="confirmed",
        tx_hash="0xabc2",
        retry_count=0,
        created_at=now - timedelta(seconds=25),
        processed_at=now,
    )
    db.add_all([e_pending, e_failed, e_confirmed1, e_confirmed2])
    db.commit()

    pending = blockchain_monitor.get_pending_transactions(db)
    assert len(pending) == 1
    assert pending[0]["id"] == e_pending.id

    failed = blockchain_monitor.get_failed_transactions(db)
    assert len(failed) == 1
    assert failed[0]["id"] == e_failed.id
    assert failed[0]["last_error"] == "RPC timeout"

    conf_metrics = blockchain_monitor.get_confirmation_metrics(db)
    assert conf_metrics["confirmed_count"] == 2
    assert conf_metrics["pending_count"] == 1
    assert conf_metrics["failed_count"] == 1
    assert conf_metrics["average_confirmation_seconds"] is not None
    assert conf_metrics["average_confirmation_seconds"] > 0

    gas_metrics = blockchain_monitor.get_gas_metrics(db)
    assert gas_metrics["confirmed_events_count"] == 2
    assert gas_metrics["estimated_total_gas_consumed"] == 2 * 52000


# ---------------------------------------------------------------------------
# Task 5: Outbox Production Optimization & Duplicate Protection
# ---------------------------------------------------------------------------


def test_outbox_worker_duplicate_transaction_skip(db: Session, chain: FakeChainService):
    # Log an initial audit event on fake chain to get a valid confirmed tx hash
    res = chain.log_audit("download", "doc-test", "user-1")

    # Create an event in status pending that already has this confirmed tx_hash
    event = AuditOutbox(
        event_type="download",
        reference_id="doc-test",
        actor="user-1",
        payload='{"ref":"doc-test","actor":"user-1"}',
        status="pending",
        tx_hash=res.tx_hash,
    )
    db.add(event)
    db.commit()

    # Process events with duplicate check
    confirmed, failed = process_pending_events(db, chain, batch_size=5)
    assert confirmed == 1
    assert failed == 0

    db.refresh(event)
    assert event.status == "confirmed"
    assert event.processed_at is not None


# ---------------------------------------------------------------------------
# Task 6: Enhanced Transaction Details API
# ---------------------------------------------------------------------------


def test_get_transaction_details_endpoint(client: TestClient, chain: FakeChainService):
    # Log an audit record to fake chain
    res = chain.log_audit("download", "file-xyz", "auditor-1")

    response = client.get(f"/transaction/{res.tx_hash}")
    assert response.status_code == 200
    data = response.json()

    assert data["tx_hash"] == res.tx_hash
    assert data["status"] == "confirmed"
    assert data["contract"] == "Audit.sol"
    assert data["event"] == "AuditLogged"
    assert data["block_number"] is not None
    assert data["gas_used"] == 21000
    assert data["confirmations"] >= 1
    assert data["chain_id"] == 1337
