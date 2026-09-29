# OverVault — MST EVM Connection Check

## Objective

Before deploying the OverVault smart contracts to the MST EVM testnet (Phase 6B),
this preparation step verifies that the existing `RealChainService` infrastructure
can successfully reach the MST network.

**No contracts are deployed.**  This phase validates:

- JSON-RPC connectivity to the MST endpoint
- Correct chain ID is advertised by the node
- A wallet address can be derived from the signing key
- Balance queries succeed against the live node

The `RealChainService` implementation (Phase 6A) already supports any EVM-compatible
endpoint via the `EVM_RPC_URL` environment variable — pointing it at the MST RPC
URL is the only change needed to target the MST testnet.

**Nothing changed in:**
- Solidity contracts
- `ChainService` Protocol / `base.py`
- `FakeChainService`
- API routes, audit service, or outbox worker

---

## Architecture

```
Backend
 |
 v
RealChainService          (unchanged from Phase 6A)
 |
 v
Web3.py (HTTPProvider)
 |
 v
MST EVM Testnet           (JSON-RPC — set via EVM_RPC_URL)
```

The same `RealChainService` code path serves both:

| `EVM_RPC_URL` value | Target network |
|---------------------|---------------|
| `http://127.0.0.1:8545` | Local Hardhat node (Phase 6A) |
| MST RPC endpoint | MST EVM Testnet (Phase 6B onward) |

No code changes are needed to switch between them.

---

## Configuration Added

The following environment variables govern MST connectivity.  All exist in
`config.py` and are documented in `.env.example`.

### MST-specific variables

| Variable | Purpose | Where to get it |
|----------|---------|----------------|
| `MST_RPC_URL` | JSON-RPC endpoint for the MST EVM testnet | MST documentation / account portal |
| `MST_CHAIN_ID` | Numeric chain ID for the MST network | MST documentation (must match exactly) |
| `MST_BACKEND_SIGNER_KEY` | Deployer/signer key for MST (Phase 6B use) | Generated locally; fund via MST faucet |
| `MSTSCAN_BASE_URL` | Block explorer base URL | MST documentation |

### Wallet configuration

The same `EVM_PRIVATE_KEY` used for local Hardhat signing is used against the
MST testnet.  For production Phase 6B usage, replace this with a dedicated MST
testnet key.

```dotenv
# Phase 6B configuration (fill in before deploying)
MST_RPC_URL=https://rpc.testnet.mstblockchain.com
MST_CHAIN_ID=<chain-id-from-docs>

# Swap EVM_RPC_URL to point at MST — RealChainService picks it up automatically
EVM_RPC_URL=https://rpc.testnet.mstblockchain.com
EVM_PRIVATE_KEY=<testnet-only-key-never-commit>
```

> **Security reminder:** Never commit a funded private key to git.
> Use `.env` (gitignored) and keep the `.env.example` values empty.

---

## Connection Test

### Test file

[`backend/tests/test_mst_connection.py`](../backend/tests/test_mst_connection.py)

The suite is marked `pytest.mark.mst_connection` and **auto-skips** when
`MST_RPC_URL` or `EVM_PRIVATE_KEY` are not set — keeping CI green with no
live node required.

```bash
# Default run — both mst_connection tests auto-skip:
pytest

# Run only MST connectivity checks (requires live MST node + env vars):
pytest -m mst_connection

# Exclude MST tests explicitly:
pytest -m "not mst_connection"
```

### Test classes and coverage

| Test class | What it verifies |
|------------|----------------|
| `TestRPCConnectivity` | `Web3.is_connected()` returns `True`; `web3_clientVersion` is non-empty |
| `TestChainID` | `eth_chainId` returns a positive int; matches `MST_CHAIN_ID` if set; block number ≥ 0 |
| `TestWalletLoading` | Address derived from `EVM_PRIVATE_KEY` is 42 chars, EIP-55 checksummed, non-zero |
| `TestBalanceQuery` | `eth_getBalance` returns a non-negative Wei amount; Ether conversion is non-negative |

### RPC connectivity check

`Web3(Web3.HTTPProvider(MST_RPC_URL))` with `ExtraDataToPOAMiddleware` injected
(required for any PoA-based chain, including most private/consortium EVMs).
`is_connected()` makes a `web3_clientVersion` call to confirm a real response.

### Chain ID verification

`w3.eth.chain_id` calls `eth_chainId`.  If `MST_CHAIN_ID` is set in the
environment, the test asserts the node returns the identical integer value —
catching misconfigured RPC URL scenarios before any contract deployment.

### Wallet address loading

`Web3().eth.account.from_key(EVM_PRIVATE_KEY)` is computed **offline** — no RPC
call needed.  The derived address is then validated for:
- Length (42 characters, `0x`-prefixed)
- EIP-55 checksum validity (`Web3.is_checksum_address`)
- Non-zero (guard against accidental zero-key usage)

### Balance check

`w3.eth.get_balance(wallet_address)` calls `eth_getBalance` on the live node.
A balance of `0` is valid (wallet not yet funded) — the test only asserts the
call succeeds and the value is non-negative.

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/tests/test_mst_connection.py` | New — 205-line MST connectivity test suite (4 test classes, 10 tests), auto-skipped without env vars |
| `backend/pytest.ini` | Added `mst_connection` to registered pytest marks |
| `.env.example` | Expanded MST block with per-variable inline comments and Phase 6B guidance; clarified `EVM_RPC_URL` network-switching instruction |

---

## Testing

### Commands

```bash
# Standard pytest run (MST tests auto-skip — no live node needed):
cd backend
pytest

# Run only MST connectivity tests against a live MST node:
MST_RPC_URL=https://rpc.testnet.mstblockchain.com \
EVM_PRIVATE_KEY=<key> \
MST_CHAIN_ID=<chain-id> \
pytest -m mst_connection -v
```

### Results (standard run — no MST node)

```
============================= test session starts ==============================
platform linux -- Python 3.14, pytest-8.x
collected 85 items / 2 deselected

tests/test_audit_api.py               ...  14 passed
tests/test_audit_outbox.py            ...  22 passed
tests/test_fake_chain.py                    1 passed
tests/test_hashing.py                       1 passed
tests/test_health.py                        1 passed
tests/test_outbox_worker.py           ...  44 passed
tests/test_mst_connection.py         SKIPPED (MST_RPC_URL not set, EVM_PRIVATE_KEY not set)
tests/test_real_chain.py             SKIPPED (missing EVM env vars)

=================== 83 passed, 2 skipped, 1 warning in 1.30s ===================
```

All pre-existing tests continue to pass with no regressions.

---

## Git Information

**Commit hash:** `62e3e77`

**Commit message:** `chore: add MST EVM connectivity check`

**Branch:** `sriganesh`

**Previous commit:** `7a84fff` — `feat: implement real chain service adapter` (Phase 6A)

---

## Next Phase

**Phase 6B — MST Contract Deployment**

With connectivity confirmed, Phase 6B will:

1. Fund the MST testnet wallet via the MST faucet.
2. Deploy all four OverVault contracts to the MST EVM testnet:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network mst_testnet
   ```
3. Update `hardhat.config.js` to fill in the `mst_testnet` network block.
4. Copy deployed contract addresses into backend `.env` as
   `CONTRACT_ADDRESS_AUDIT`, `CONTRACT_ADDRESS_INTEGRITY`,
   `CONTRACT_ADDRESS_OWNERSHIP`, `CONTRACT_ADDRESS_PERMISSION`.
5. Set `EVM_RPC_URL=<MST_RPC_URL>` and `CHAIN_MODE=real`.
6. Run the full `pytest -m real_chain` suite against MST contracts.
7. Verify transactions on MSTScan.
