"""Demo: exercises the ChainService interface end-to-end using FakeChainService.

Run from the backend directory:

    python -m app.chain.demo

This script demonstrates all four operation groups defined in ChainService
without requiring a running database or MST EVM node.  It serves as a
living example of how backend services should interact with the chain layer.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from app.chain.fake import FakeChainService


def demo_record_audit_event(chain: FakeChainService) -> None:
    """Demonstrate recording an audit event and retrieving the trail."""
    print("\n── Audit Event ──────────────────────────────────")
    result = chain.log_audit(
        event_type="upload",
        ref="file-abc123",
        actor="0xDeadBeef",
    )
    print(f"  log_audit()      → tx_hash={result.tx_hash}  status={result.status}")

    trail = chain.get_audit_trail("file-abc123")
    print(f"  get_audit_trail() → {len(trail)} record(s)")
    for entry in trail:
        print(f"    {entry.event_type!r}  ref={entry.ref}  actor={entry.actor}")


def demo_store_and_verify_hash(chain: FakeChainService) -> None:
    """Demonstrate the document integrity hash flow.

    Flow:
        document hash
            │
            ▼
        FakeChain.commit_hash()
            │
            ▼
        transaction hash returned
            │
            ▼
        FakeChain.verify_hash()
    """
    print("\n── Hash Commitment ──────────────────────────────")
    doc_hash = "sha256:e3b0c44298fc1c149afbf4c8996fb924"
    result = chain.commit_hash(
        file_id="file-abc123",
        version=2,
        content_hash=doc_hash,
    )
    print(f"  commit_hash()    → tx_hash={result.tx_hash}  status={result.status}")

    verified = chain.verify_hash("file-abc123", 2, doc_hash)
    print(f"  verify_hash()    → {verified}  (expected: True)")

    tampered = chain.verify_hash("file-abc123", 2, "sha256:tampered")
    print(f"  verify_hash()    → {tampered}  (expected: False, tampered hash)")


def demo_verify_transaction(chain: FakeChainService) -> None:
    """Demonstrate verify_transaction() for known and unknown hashes."""
    print("\n── Transaction Verification ─────────────────────")
    result = chain.register_ownership(
        file_id="file-abc123",
        owner_address="0xOwnerAddress",
        content_hash="sha256:initialcontent",
    )
    print(f"  register_ownership() → tx_hash={result.tx_hash}")

    valid = chain.verify_transaction(result.tx_hash)
    print(f"  verify_transaction({result.tx_hash[:10]}…) → {valid}  (expected: True)")

    invalid = chain.verify_transaction("0xdeadbeef00000000000000000000000000000000")
    print(f"  verify_transaction(unknown)               → {invalid}  (expected: False)")


def main() -> None:
    """Run all demo scenarios against a single FakeChainService instance."""
    print("OverVault ChainService demo — using FakeChainService")
    print("=" * 52)

    chain = FakeChainService()

    demo_record_audit_event(chain)
    demo_store_and_verify_hash(chain)
    demo_verify_transaction(chain)

    print("\n── Done ─────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
