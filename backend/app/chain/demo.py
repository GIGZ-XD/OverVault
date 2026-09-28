"""Standalone demo: python -m app.chain.demo
Exercises all four record types without the backend. Ganesh fills this in against testnet."""
from app.chain.fake import FakeChainService


def main():
    chain = FakeChainService()
    print(chain.register_ownership("demo-file", "0xabc", "deadbeef"))


if __name__ == "__main__":
    main()
