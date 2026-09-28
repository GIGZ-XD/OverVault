# Setup

1. Install Docker, Python 3.12, Node 20.
2. Install the **BridgeKey Wallet** Chrome extension.
3. Claim **$MSTC** testnet tokens from the MST Faucet for every dev account.
4. `cp .env.example .env` and fill testnet values (never commit).
5. `make up`, then `make backend` and `make frontend`.
6. Default modes are mock/dev/fake, so everything runs without the chain or wallet.
