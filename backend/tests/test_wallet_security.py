"""Production Wallet and Transaction Security Tests.

Tests:
- Missing private key fast-fail error handling
- Invalid private key validation
- Isolated local raw transaction signing
- Sensitive secret masking and prevention of private key log leaks

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from eth_account import Account
from web3 import Web3

from app.chain.config import MSTChainConfig, mask_secret
from app.chain.real import RealChainService


class TestWalletConfigurationAndMasking:
    def test_mask_secret_utility(self):
        secret = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        masked = mask_secret(secret)
        assert secret not in masked
        assert masked == "0xac...ff80"

        assert mask_secret(None) == "<not-set>"
        assert mask_secret("") == "<not-set>"
        assert mask_secret("short") == "***"

    def test_missing_private_key_raises_informative_value_error(self):
        with patch.dict(os.environ, {"MST_RPC_URL": "http://127.0.0.1:8545"}, clear=True):
            with pytest.raises(ValueError, match="MST_PRIVATE_KEY"):
                MSTChainConfig.from_env()

    def test_invalid_private_key_fails_cleanly(self):
        w3 = Web3()
        with pytest.raises(Exception):
            w3.eth.account.from_key("not-a-valid-hex-private-key")


class TestLocalTransactionSigningIsolation:
    def test_transaction_signing_creates_signed_payload(self):
        # Generate a temporary ephemeral test key for local signing test
        test_account = Account.create()
        assert test_account.address.startswith("0x")

        tx = {
            "to": "0x0000000000000000000000000000000000000000",
            "value": 0,
            "gas": 21000,
            "gasPrice": 1000000000,
            "nonce": 0,
            "chainId": 1337,
        }

        signed = test_account.sign_transaction(tx)
        assert hasattr(signed, "raw_transaction")
        assert signed.raw_transaction is not None
        assert len(signed.raw_transaction) > 0

    def test_real_chain_service_masks_private_key_in_summary(self):
        env_vars = {
            "MST_RPC_URL": "http://127.0.0.1:8545",
            "MST_CHAIN_ID": "1337",
            "MST_PRIVATE_KEY": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            "CONTRACT_AUDIT_ADDRESS": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            "CONTRACT_INTEGRITY_ADDRESS": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
            "CONTRACT_OWNERSHIP_ADDRESS": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
            "CONTRACT_PERMISSION_ADDRESS": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            cfg = MSTChainConfig.from_env()
            summary = cfg.to_safe_summary()
            assert env_vars["MST_PRIVATE_KEY"] not in str(summary)
            assert summary["private_key"] == "0xac...ff80"
