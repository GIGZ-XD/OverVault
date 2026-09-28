from app.chain.fake import FakeChainService


def test_ownership_and_hash_verify():
    chain = FakeChainService()
    chain.register_ownership("f1", "0xabc", "h1")
    assert chain.verify_hash("f1", 1, "h1")
    assert not chain.verify_hash("f1", 1, "other")
