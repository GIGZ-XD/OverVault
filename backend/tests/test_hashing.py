from app.services import hashing


def test_sha256_known_vector():
    assert hashing.sha256_hex(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_verify():
    h = hashing.sha256_hex(b"x")
    assert hashing.verify_sha256(b"x", h) and hashing.verify_sha256(b"x", h.upper())
    assert not hashing.verify_sha256(b"y", h)
