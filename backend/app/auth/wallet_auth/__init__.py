"""wallet_auth package (Pannaga).

Public API:
    create_nonce(address) -> {"nonce": ..., "message": ...}
    verify_wallet_login(address, signature) -> WalletIdentity
    WalletIdentity
    WalletAuthError / NonceExpiredError / InvalidSignatureError / AddressNotFoundError
"""
from app.auth.wallet_auth.nonce import create_nonce, consume_nonce, peek_nonce
from app.auth.wallet_auth.verify import (
    WalletIdentity,
    WalletAuthError,
    NonceExpiredError,
    InvalidSignatureError,
    AddressNotFoundError,
    verify_wallet_login,
    verify_wallet_signature,
)

__all__ = [
    "create_nonce",
    "consume_nonce",
    "peek_nonce",
    "WalletIdentity",
    "WalletAuthError",
    "NonceExpiredError",
    "InvalidSignatureError",
    "AddressNotFoundError",
    "verify_wallet_login",
    "verify_wallet_signature",
]
