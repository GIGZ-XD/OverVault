"""MST Testnet Startup Validation.

Verifies:
1. Private key is present (fails startup if missing)
2. MST RPC is reachable
3. Chain ID matches 91562037
4. Wallet has positive MST balance
5. Deployed contracts (Integrity, Audit, Ownership, Permission) exist and contain bytecode
"""
from __future__ import annotations

import logging
from eth_account import Account
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.config import Settings

logger = logging.getLogger("overvault.chain.validation")


def validate_mst_startup(settings: Settings) -> None:
    """Run full validation of the MST Testnet configuration and blockchain state.

    Raises:
        RuntimeError: If private key is missing.
        ConnectionError: If MST RPC is unreachable.
        ValueError: If Chain ID or contract addresses or wallet balance are invalid.
    """
    # 1. Validate Private Key
    private_key = settings.get_effective_private_key()
    if not private_key:
        raise RuntimeError(
            "MST Startup Validation Failed: Private key is missing in environment! "
            "Please configure MST_PRIVATE_KEY or MST_BACKEND_SIGNER_KEY in .env."
        )

    # 2. Validate RPC Reachability
    rpc_url = settings.get_effective_rpc_url()
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        raise ConnectionError(
            f"MST Startup Validation Failed: Cannot reach MST RPC endpoint at '{rpc_url}'."
        )

    # 3. Validate Chain ID
    chain_id = w3.eth.chain_id
    expected_chain_id = settings.mst_chain_id or 91562037
    if chain_id != expected_chain_id:
        raise ValueError(
            f"MST Startup Validation Failed: Chain ID mismatch! "
            f"Connected network reported {chain_id}, expected MST Testnet {expected_chain_id}."
        )

    # 4. Validate Wallet and Balance
    account = Account.from_key(private_key)
    wallet_address = account.address
    balance_wei = w3.eth.get_balance(wallet_address)
    if balance_wei <= 0:
        raise ValueError(
            f"MST Startup Validation Failed: Signer wallet {wallet_address} has zero balance on MST Testnet. "
            "Fund the wallet via MST faucet before starting the backend."
        )
    balance_mst = w3.from_wei(balance_wei, "ether")

    # 5. Validate Deployed Contracts
    contracts = {
        "Integrity Contract": settings.contract_address_integrity,
        "Audit Contract": settings.contract_address_audit,
        "Ownership Contract": settings.contract_address_ownership,
        "Permission Contract": settings.contract_address_permission,
    }

    for name, addr in contracts.items():
        if not addr or not Web3.is_address(addr):
            raise ValueError(
                f"MST Startup Validation Failed: Invalid address for {name}: '{addr}'"
            )
        checksum_addr = Web3.to_checksum_address(addr)
        code = w3.eth.get_code(checksum_addr)
        if len(code) == 0:
            raise ValueError(
                f"MST Startup Validation Failed: No bytecode deployed for {name} at {checksum_addr} on MST Testnet."
            )

    # Output formatted logs matching Requirement 9
    print("\n" + "=" * 60)
    print("MST Connected: True")
    print(f"Chain ID: {chain_id}")
    print(f"Integrity Contract:\n{settings.contract_address_integrity}")
    print(f"Audit Contract:\n{settings.contract_address_audit}")
    print(f"Ownership Contract:\n{settings.contract_address_ownership}")
    print(f"Permission Contract:\n{settings.contract_address_permission}")
    print(f"Wallet:\n{wallet_address} (Balance: {balance_mst:.4f} MST)")
    print("Ready.")
    print("=" * 60 + "\n")

    logger.info("MST Testnet validation successful. Signer wallet: %s", wallet_address)
