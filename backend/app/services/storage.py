"""Private encrypted file storage. Hash is verified on EVERY read."""
import os
from pathlib import Path

from app.config import get_settings
from app.services import encryption, hashing
from app.services.rbac import IntegrityViolation, NotFound


def _root() -> Path:
    root = Path(get_settings().storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _path_for(storage_key: str) -> Path:
    root = _root()
    p = (root / storage_key).resolve()
    if root not in p.parents:
        raise IntegrityViolation("Invalid storage key.")
    return p


def make_key(file_id: str, version_number: int) -> str:
    return f"{file_id}/v{version_number}.bin"


def save(storage_key: str, plaintext: bytes) -> None:
    path = _path_for(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(encryption.encrypt(plaintext))
    os.replace(tmp, path)  # atomic


def read_verified(storage_key: str, expected_sha256: str) -> bytes:
    path = _path_for(storage_key)
    if not path.exists():
        raise NotFound("Stored file content is missing.")
    plaintext = encryption.decrypt(path.read_bytes())
    if not hashing.verify_sha256(plaintext, expected_sha256):
        raise IntegrityViolation("Hash mismatch: stored content does not match its recorded SHA-256.")
    return plaintext
