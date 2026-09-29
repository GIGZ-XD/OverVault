"""Integration tests for MST Testnet blockchain upload and verification.

Tests the full end-to-end flow against live MST Testnet:
1. Upload file
2. Generate SHA-256 hash
3. Send MST transaction (Integrity, Ownership, Audit)
4. Verify transaction exists and is confirmed on-chain
5. Verify contract state (Integrity, Ownership, Audit, Permission)
6. Verify file hash matches blockchain via POST /api/files/{id}/verify

MST Testnet Chain ID: 91562037
RPC: https://testnetrpc.mstblockchain.com
MSTScan: https://mstscan.io
"""
from __future__ import annotations

import hashlib
import io
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.auth import dev_auth
from app.auth.jwt import create_access_token
from app.chain.real import RealChainService
from app.config import get_settings
from app.db import get_db
from app.main import create_app
from app.models import Base, User
from app.models.blockchain_transaction import BlockchainTransaction


pytestmark = pytest.mark.mst_real_chain


@pytest.fixture(scope="module")
def live_settings():
    """Load settings configured for live MST Testnet."""
    s = get_settings()
    return s


@pytest.fixture(scope="module")
def w3(live_settings):
    """Web3 connection to live MST Testnet."""
    provider = Web3.HTTPProvider(live_settings.get_effective_rpc_url())
    client = Web3(provider)
    client.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    assert client.is_connected(), f"Cannot connect to MST RPC at {live_settings.get_effective_rpc_url()}"
    return client


@pytest.fixture(scope="module")
def real_chain(live_settings):
    """RealChainService instance connected to MST Testnet."""
    return RealChainService(
        rpc_url=live_settings.get_effective_rpc_url(),
        private_key=live_settings.get_effective_private_key(),
        contract_address_audit=live_settings.contract_address_audit,
        contract_address_integrity=live_settings.contract_address_integrity,
        contract_address_ownership=live_settings.contract_address_ownership,
        contract_address_permission=live_settings.contract_address_permission,
    )


@pytest.fixture
def test_env(tmp_path, live_settings, monkeypatch):
    """Test client and database configured for live chain testing."""
    monkeypatch.setattr(live_settings, "chain_mode", "real")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    dev_auth.seed_dev_users(session, force=True)

    app = create_app()
    app.dependency_overrides[get_db] = lambda: session

    client = TestClient(app)
    admin = session.query(User).filter(User.role == "admin").first()
    employee = session.query(User).filter(User.role == "employee").first()
    manager = session.query(User).filter(User.role == "manager").first()

    tokens = {
        "admin": create_access_token(admin),
        "employee": create_access_token(employee),
        "manager": create_access_token(manager),
    }

    yield {
        "client": client,
        "db": session,
        "tokens": tokens,
        "admin": admin,
        "employee": employee,
        "manager": manager,
    }

    session.close()


class TestMSTUploadAndIntegrityFlow:
    """Complete validation of file upload, hash commitment, ownership, audit, and verification."""

    def test_mst_upload_end_to_end(self, test_env, real_chain, w3, live_settings):
        """Test full file upload -> SHA256 -> MST Integrity Contract -> MSTScan confirmation -> Verify."""
        client = test_env["client"]
        db = test_env["db"]
        token = test_env["tokens"]["employee"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Prepare unique file content and compute SHA-256
        test_payload = (
            f"OverVault Confidential Document - Real MST Testnet Blockchain Verification - {uuid.uuid4()}"
        ).encode("utf-8")
        expected_sha256 = hashlib.sha256(test_payload).hexdigest()
        filename = f"q3_financial_report_{uuid.uuid4().hex[:6]}.pdf"

        # 2. Upload file via API
        response = client.post(
            "/api/files",
            headers=headers,
            files={"upload": (filename, io.BytesIO(test_payload), "application/pdf")},
            data={"comment": "Audited Q3 earnings report"},
        )
        assert response.status_code == 201, f"Upload failed: {response.text}"
        data = response.json()
        file_id = data["id"]
        tx_hash = data.get("ownership_tx")

        print(f"\n--- Uploaded File: {file_id} ---")
        print(f"Content SHA256: {expected_sha256}")
        print(f"Blockchain Tx Hash: {tx_hash}")
        if tx_hash:
            print(f"MSTScan URL: https://mstscan.io/tx/{tx_hash}")

        # 3. Verify transaction was sent and recorded
        assert tx_hash is not None, "Transaction hash must not be None"
        assert tx_hash.startswith("0x"), f"Transaction hash '{tx_hash}' must start with 0x"
        assert len(tx_hash) == 66, f"Transaction hash '{tx_hash}' must be 66 characters"

        # 4. Verify transaction exists on live MST Testnet
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        assert receipt is not None, f"Receipt for {tx_hash} not found on MST Testnet"
        assert receipt.status == 1, f"Transaction {tx_hash} failed on MST Testnet (status={receipt.status})"
        assert real_chain.get_tx_status(tx_hash) == "confirmed"

        # 5. Verify contract state on live MST Integrity contract
        # Verify hash call
        is_verified_on_chain = real_chain.verify_hash(file_id, 1, expected_sha256)
        assert is_verified_on_chain is True, (
            f"Integrity contract did not verify hash {expected_sha256} for file {file_id} v1"
        )

        # Retrieve stored hash from contract
        stored_hash = real_chain.get_hash(file_id, 1)
        assert stored_hash.lower() == expected_sha256.lower(), (
            f"Stored contract hash '{stored_hash}' does not match expected '{expected_sha256}'"
        )

        # 6. Verify Blockchain Transaction tracking in Database
        db_tx = (
            db.query(BlockchainTransaction)
            .filter(BlockchainTransaction.reference_id == file_id)
            .first()
        )
        assert db_tx is not None, "BlockchainTransaction record must exist in database"
        assert db_tx.status == "confirmed"
        print(f"Database tracked tx: {db_tx.tx_hash} (contract={db_tx.contract_called}, action={db_tx.action})")

        # 7. Test Verification endpoint POST /api/files/{file_id}/verify
        verify_resp = client.post(f"/api/files/{file_id}/verify", headers=headers)
        assert verify_resp.status_code == 200, f"Verify endpoint failed: {verify_resp.text}"
        verify_data = verify_resp.json()

        print(f"Verification Response: {verify_data}")
        assert verify_data["verified"] is True
        assert verify_data["status"] == "VALID"
        assert verify_data["source"] == "MST Testnet"
        assert verify_data["local_hash"] == expected_sha256
        assert verify_data["chain_hash"] == expected_sha256

        # 8. Test on-chain Permission Grant
        grantee = test_env["manager"]
        grant_resp = client.post(
            f"/api/files/{file_id}/permissions",
            headers=headers,
            json={
                "grantee": grantee.id,
                "permission": "read",
                "expires_at": "2030-01-01T00:00:00Z",
            },
        )
        assert grant_resp.status_code == 201, f"Permission grant failed: {grant_resp.text}"

        # Verify on-chain permission contract state
        grantee_addr = grantee.wallet_address or grantee.id
        has_perm_on_chain = real_chain._permission.functions.checkPermission(
            file_id,
            real_chain._safe_address(grantee_addr),
            "read",
        ).call()
        assert has_perm_on_chain is True, "Permission must be active on MST Permission contract"
        print(f"Permission verified on MST Permission contract for grantee {grantee.id}")

        # 9. Verify Audit Trail on MST Audit contract
        audit_records = real_chain.get_audit_trail(file_id)
        assert len(audit_records) > 0, "Audit entries for file must exist on MST Audit contract"
        event_types = [r.event_type for r in audit_records]
        assert "FILE_CREATED" in event_types, f"FILE_CREATED missing from audit entries: {event_types}"
        print(f"Audit events on-chain for {file_id}: {event_types}")
