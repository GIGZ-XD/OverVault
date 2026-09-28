"""Encryption at rest (Fernet = AES-128-CBC + HMAC-SHA256, authenticated)."""
import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.services.rbac import IntegrityViolation


@lru_cache
def _fernet_for(master_key: str) -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(master_key.encode()).digest())
    return Fernet(key)


def _fernet() -> Fernet:
    return _fernet_for(get_settings().master_key)


def encrypt(plaintext: bytes) -> bytes:
    return _fernet().encrypt(plaintext)


def decrypt(ciphertext: bytes) -> bytes:
    try:
        return _fernet().decrypt(ciphertext)
    except InvalidToken as exc:
        raise IntegrityViolation("Stored file could not be decrypted (wrong key or tampered data).") from exc
