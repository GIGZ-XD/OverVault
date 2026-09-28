"""MST EVM Connectivity Check — pre-Phase-6B preparation tests.

These tests verify network-level connectivity to the MST EVM testnet.
No deployed contracts are required — every check uses only standard
JSON-RPC calls (``eth_chainId``, ``eth_getBalance``, etc.).

The full suite is **auto-skipped** when either required environment
variable is absent, so ``pytest`` in CI always passes cleanly.

Required environment variables
-------------------------------
MST_RPC_URL      JSON-RPC endpoint for the MST EVM testnet.
                 Example: https://rpc.testnet.mstblockchain.com
EVM_PRIVATE_KEY  Hex private key whose address will be queried.
                 This is the same wallet used by RealChainService.

Optional
--------
MST_CHAIN_ID     Expected numeric chain ID (string).  When set, the
                 suite asserts that the node reports this exact ID.

Running
-------
    # Skip MST tests (default — no live node):
    pytest -m "not mst_connection"

    # Run only MST tests (requires live MST node + env vars):
    pytest -m mst_connection

Mark:  pytest.mark.mst_connection
Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import os

import pytest
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

# ---------------------------------------------------------------------------
# Auto-skip when prerequisite env vars are missing
# ---------------------------------------------------------------------------

_MST_RPC_URL = os.environ.get("MST_RPC_URL", "").strip()
_EVM_PRIVATE_KEY = os.environ.get("EVM_PRIVATE_KEY", "").strip()
_MST_CHAIN_ID = os.environ.get("MST_CHAIN_ID", "").strip()

pytestmark = pytest.mark.mst_connection

_skip_reason_parts: list[str] = []
if not _MST_RPC_URL:
    _skip_reason_parts.append("MST_RPC_URL not set")
if not _EVM_PRIVATE_KEY:
    _skip_reason_parts.append("EVM_PRIVATE_KEY not set")

if _skip_reason_parts:
    pytest.skip(
        "Skipping MST connectivity tests — "
        + ", ".join(_skip_reason_parts)
        + ". Set these env vars (see .env.example) to run the suite.",
        allow_module_level=True,
    )


# ---------------------------------------------------------------------------
# Module-level Web3 fixture — one connection per test session
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def w3() -> Web3:
    """Return a connected Web3 instance pointed at MST_RPC_URL."""
    instance = Web3(Web3.HTTPProvider(_MST_RPC_URL))
    # Inject PoA middleware — MST EVM may use a PoA consensus engine
    instance.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return instance


@pytest.fixture(scope="module")
def wallet_address() -> str:
    """Return the checksummed address derived from EVM_PRIVATE_KEY."""
    _w3 = Web3()  # offline instance — no RPC needed for key derivation
    account = _w3.eth.account.from_key(_EVM_PRIVATE_KEY)
    return account.address


# ---------------------------------------------------------------------------
# 1. RPC connectivity
# ---------------------------------------------------------------------------


class TestRPCConnectivity:
    """Verify that a TCP/HTTP connection to MST_RPC_URL can be established."""

    def test_web3_is_connected(self, w3: Web3) -> None:
        """``Web3.is_connected()`` must return True for a reachable node."""
        assert w3.is_connected(), (
            f"Could not connect to MST RPC at '{_MST_RPC_URL}'. "
            "Check that the URL is correct and the node is reachable."
        )

    def test_client_version_is_non_empty(self, w3: Web3) -> None:
        """``web3_clientVersion`` must return a non-empty string."""
        version = w3.client_version
        assert isinstance(version, str) and len(version) > 0, (
            f"Expected a non-empty client version string, got: {version!r}"
        )


# ---------------------------------------------------------------------------
# 2. Chain ID verification
# ---------------------------------------------------------------------------


class TestChainID:
    """Verify that the node reports the expected MST chain ID."""

    def test_chain_id_is_returned(self, w3: Web3) -> None:
        """``eth_chainId`` must return a positive integer."""
        chain_id = w3.eth.chain_id
        assert isinstance(chain_id, int) and chain_id > 0, (
            f"Expected a positive integer chain ID, got: {chain_id!r}"
        )

    def test_chain_id_matches_config(self, w3: Web3) -> None:
        """If MST_CHAIN_ID is set, the node must report the same value."""
        if not _MST_CHAIN_ID:
            pytest.skip("MST_CHAIN_ID not set — skipping chain-ID assertion")

        try:
            expected = int(_MST_CHAIN_ID)
        except ValueError:
            pytest.fail(f"MST_CHAIN_ID='{_MST_CHAIN_ID}' is not a valid integer.")

        actual = w3.eth.chain_id
        assert actual == expected, (
            f"Chain ID mismatch: expected {expected} (from MST_CHAIN_ID env var) "
            f"but node returned {actual}. Verify MST_CHAIN_ID is correct."
        )

    def test_block_number_is_non_negative(self, w3: Web3) -> None:
        """``eth_blockNumber`` must return a non-negative integer (basic liveness)."""
        block_number = w3.eth.block_number
        assert isinstance(block_number, int) and block_number >= 0, (
            f"Unexpected block number: {block_number!r}"
        )


# ---------------------------------------------------------------------------
# 3. Wallet address loading
# ---------------------------------------------------------------------------


class TestWalletLoading:
    """Verify that EVM_PRIVATE_KEY can be used to derive a valid wallet address."""

    def test_address_is_derived(self, wallet_address: str) -> None:
        """Address must be a non-empty checksummed Ethereum address."""
        assert isinstance(wallet_address, str) and len(wallet_address) == 42, (
            f"Expected a 42-character Ethereum address, got: {wallet_address!r}"
        )

    def test_address_is_checksummed(self, wallet_address: str) -> None:
        """Address must pass EIP-55 checksum validation."""
        assert Web3.is_checksum_address(wallet_address), (
            f"Address '{wallet_address}' is not a valid EIP-55 checksummed address."
        )

    def test_address_is_non_zero(self, wallet_address: str) -> None:
        """Address must not be the zero address."""
        zero = "0x" + "0" * 40
        assert wallet_address.lower() != zero.lower(), (
            "Derived wallet address is the zero address — EVM_PRIVATE_KEY is invalid."
        )


# ---------------------------------------------------------------------------
# 4. Balance query
# ---------------------------------------------------------------------------


class TestBalanceQuery:
    """Verify that an ETH balance can be retrieved for the wallet address."""

    def test_balance_query_succeeds(self, w3: Web3, wallet_address: str) -> None:
        """``eth_getBalance`` must return a non-negative integer (in Wei)."""
        balance_wei = w3.eth.get_balance(wallet_address)
        assert isinstance(balance_wei, int) and balance_wei >= 0, (
            f"Unexpected balance value: {balance_wei!r}"
        )

    def test_balance_is_reported_in_ether(self, w3: Web3, wallet_address: str) -> None:
        """Balance converted to Ether must be a non-negative float."""
        balance_wei = w3.eth.get_balance(wallet_address)
        balance_eth = float(Web3.from_wei(balance_wei, "ether"))
        assert balance_eth >= 0.0, (
            f"Negative Ether balance is impossible: {balance_eth}"
        )

    def test_balance_query_for_zero_address(self, w3: Web3) -> None:
        """Balance query for the zero address must not crash (sanity check)."""
        zero = Web3.to_checksum_address("0x" + "0" * 40)
        balance_wei = w3.eth.get_balance(zero)
        assert isinstance(balance_wei, int) and balance_wei >= 0
