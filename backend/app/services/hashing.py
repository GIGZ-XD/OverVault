import hashlib


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify(data: bytes, expected_hex: str) -> bool:
    return sha256_hex(data) == expected_hex
