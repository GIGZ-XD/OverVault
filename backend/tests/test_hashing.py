from app.services.hashing import sha256_hex, verify


def test_hash_roundtrip():
    data = b"hello"
    assert verify(data, sha256_hex(data))
    assert not verify(b"tampered", sha256_hex(data))
