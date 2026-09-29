import pytest

from app.services import encryption, hashing, storage
from app.services.rbac import IntegrityViolation, NotFound


def test_roundtrip_is_encrypted_on_disk(db):
    data = b"top secret"
    storage.save("f1/v1.bin", data)
    raw = (storage._root() / "f1/v1.bin").read_bytes()
    assert data not in raw and encryption.decrypt(raw) == data
    assert storage.read_verified("f1/v1.bin", hashing.sha256_hex(data)) == data


def test_hash_mismatch_detected(db):
    storage.save("f1/v1.bin", b"abc")
    with pytest.raises(IntegrityViolation):
        storage.read_verified("f1/v1.bin", hashing.sha256_hex(b"different"))


def test_tampered_ciphertext_detected(db):
    storage.save("f1/v1.bin", b"abc")
    p = storage._root() / "f1/v1.bin"
    p.write_bytes(p.read_bytes()[:-3] + b"xyz")
    with pytest.raises(IntegrityViolation):
        storage.read_verified("f1/v1.bin", hashing.sha256_hex(b"abc"))


def test_missing_and_traversal(db):
    with pytest.raises(NotFound):
        storage.read_verified("nope/v1.bin", "0" * 64)
    with pytest.raises(IntegrityViolation):
        storage.save("../escape.bin", b"x")
