"""Phase 6B — MST EVM Contract Deployment Integration Tests.

Validates RealChainService interaction with deployed OverVault contracts
on the MST EVM testnet (or simulated testnet).

Verifications:
1. Connect to MST RPC endpoint
2. Load deployed contract addresses
3. Create RealChainService instance
4. Submit transactions:
   - log_audit()
   - commit_hash()
   - register_ownership()
5. Verify transaction status and transaction hash for each call.

The entire test suite is auto-skipped if:
- MST RPC URL is missing
- Private key is missing
- Deployed contract addresses are missing

Mark: pytest.mark.mst_real_chain
Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import uuid

import pytest
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.chain.base import TxResult
from app.chain.real import RealChainService

# ---------------------------------------------------------------------------
# Resolve Configuration (Environment Variables with testnet artifact fallback)
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_DEPLOYED_TESTNET_JSON = _PROJECT_ROOT / "contracts" / "deployed.testnet.json"

_MST_RPC_URL = os.environ.get("MST_RPC_URL", "").strip() or os.environ.get("EVM_RPC_URL", "").strip()
_MST_PRIVATE_KEY = os.environ.get("MST_PRIVATE_KEY", "").strip() or os.environ.get("EVM_PRIVATE_KEY", "").strip()

# Attempt to load contract addresses from env or deployed.testnet.json
_ADDR_AUDIT = os.environ.get("CONTRACT_ADDRESS_AUDIT", "").strip()
_ADDR_INTEGRITY = os.environ.get("CONTRACT_ADDRESS_INTEGRITY", "").strip()
_ADDR_OWNERSHIP = os.environ.get("CONTRACT_ADDRESS_OWNERSHIP", "").strip()
_ADDR_PERMISSION = os.environ.get("CONTRACT_ADDRESS_PERMISSION", "").strip()

if not all([_ADDR_AUDIT, _ADDR_INTEGRITY, _ADDR_OWNERSHIP, _ADDR_PERMISSION]):
    if _DEPLOYED_TESTNET_JSON.exists():
        try:
            with open(_DEPLOYED_TESTNET_JSON, "r", encoding="utf-8") as f:
                _data = json.load(f)
                contracts = _data.get("contracts", {})
                _ADDR_AUDIT = _ADDR_AUDIT or contracts.get("audit", {}).get("address", "")
                _ADDR_INTEGRITY = _ADDR_INTEGRITY or contracts.get("integrity", {}).get("address", "")
                _ADDR_OWNERSHIP = _ADDR_OWNERSHIP or contracts.get("ownership", {}).get("address", "")
                _ADDR_PERMISSION = _ADDR_PERMISSION or contracts.get("permission", {}).get("address", "")
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Auto-skip check
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.mst_real_chain

_missing: list[str] = []
if not _MST_RPC_URL:
    _missing.append("MST_RPC_URL (or EVM_RPC_URL)")
if not _MST_PRIVATE_KEY:
    _missing.append("MST_PRIVATE_KEY (or EVM_PRIVATE_KEY)")
if not _ADDR_AUDIT:
    _missing.append("CONTRACT_ADDRESS_AUDIT")
if not _ADDR_INTEGRITY:
    _missing.append("CONTRACT_ADDRESS_INTEGRITY")
if not _ADDR_OWNERSHIP:
    _missing.append("CONTRACT_ADDRESS_OWNERSHIP")
if not _ADDR_PERMISSION:
    _missing.append("CONTRACT_ADDRESS_PERMISSION")

if _missing:
    pytest.skip(
        f"Skipping MST RealChain integration tests — missing required configuration: {', '.join(_missing)}. "
        "Set MST_RPC_URL, MST_PRIVATE_KEY, and contract addresses to run.",
        allow_module_level=True,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def w3() -> Web3:
    """Instantiate a Web3 connection directly to verify the RPC layer."""
    provider = Web3.HTTPProvider(_MST_RPC_URL)
    web3_client = Web3(provider)
    web3_client.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return web3_client


@pytest.fixture(scope="module")
def chain() -> RealChainService:
    """Instantiate RealChainService with the resolved configuration."""
    return RealChainService(
        rpc_url=_MST_RPC_URL,
        private_key=_MST_PRIVATE_KEY,
        contract_address_audit=_ADDR_AUDIT,
        contract_address_integrity=_ADDR_INTEGRITY,
        contract_address_ownership=_ADDR_OWNERSHIP,
        contract_address_permission=_ADDR_PERMISSION,
    )


@pytest.fixture
def file_id() -> str:
    """Unique file ID per test case to avoid state collision."""
    return f"mst-test-file-{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMSTConnectionAndSetup:
    def test_rpc_connection(self, w3: Web3):
        """1. Connect to MST RPC: verify node is online and reporting block number."""
        assert w3.is_connected(), f"Failed to connect to MST RPC at {_MST_RPC_URL}"
        block = w3.eth.block_number
        assert block >= 0, "RPC must report a non-negative block number"
        chain_id = w3.eth.chain_id
        assert chain_id > 0, "RPC must report a positive chain ID"

    def test_load_contract_addresses(self, w3: Web3):
        """2. Load deployed contract addresses and verify contract bytecode exists."""
        for name, addr in [
            ("Audit", _ADDR_AUDIT),
            ("Integrity", _ADDR_INTEGRITY),
            ("Ownership", _ADDR_OWNERSHIP),
            ("Permission", _ADDR_PERMISSION),
        ]:
            assert Web3.is_address(addr), f"{name} address '{addr}' is not a valid EVM address"
            checksum_addr = Web3.to_checksum_address(addr)
            code = w3.eth.get_code(checksum_addr)
            assert len(code) > 0, f"No bytecode found at deployed {name} contract address {checksum_addr}"

    def test_create_real_chain_service(self, chain: RealChainService):
        """3. Create RealChainService: verify instantiation and signer address."""
        assert chain is not None
        assert chain._account.address.startswith("0x")
        assert len(chain._account.address) == 42


class TestMSTRealChainOperations:
    def test_submit_log_audit(self, chain: RealChainService, file_id: str):
        """4a. Submit log_audit() and verify transaction status and hash."""
        result: TxResult = chain.log_audit(
            event_type="MST_DEPLOY_VERIFY",
            ref=file_id,
            actor="sriganesh-blockchain-engineer",
        )
        assert result.status == "confirmed", f"log_audit transaction failed with status {result.status}"
        assert result.tx_hash.startswith("0x"), "tx_hash must start with '0x'"
        assert len(result.tx_hash) == 66, "tx_hash must be a 66-character hex string"
        assert chain.verify_transaction(result.tx_hash) is True

    def test_submit_commit_hash(self, chain: RealChainService, file_id: str):
        """4b. Submit commit_hash() and verify transaction status and hash."""
        content_hash = "sha256-mst-" + uuid.uuid4().hex
        result: TxResult = chain.commit_hash(
            file_id=file_id,
            version=1,
            content_hash=content_hash,
        )
        assert result.status == "confirmed", f"commit_hash transaction failed with status {result.status}"
        assert result.tx_hash.startswith("0x"), "tx_hash must start with '0x'"
        assert len(result.tx_hash) == 66, "tx_hash must be a 66-character hex string"
        # Confirm hash is queryable from contract
        assert chain.verify_hash(file_id, 1, content_hash) is True

    def test_submit_register_ownership(self, chain: RealChainService, file_id: str):
        """4c. Submit register_ownership() and verify transaction status and hash."""
        owner = chain._account.address
        content_hash = "sha256-mst-owner-" + uuid.uuid4().hex
        result: TxResult = chain.register_ownership(
            file_id=file_id,
            owner_address=owner,
            content_hash=content_hash,
        )
        assert result.status == "confirmed", f"register_ownership failed with status {result.status}"
        assert result.tx_hash.startswith("0x"), "tx_hash must start with '0x'"
        assert len(result.tx_hash) == 66, "tx_hash must be a 66-character hex string"
        assert chain.verify_transaction(result.tx_hash) is True
