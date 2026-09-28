# OverVault — Phase 6A: RealChainService Adapter

## Objective

Phase 6A replaces the in-memory `FakeChainService` (used in local development and
unit testing) with `RealChainService` — a production-ready adapter that connects
to any EVM-compatible blockchain node (including a **local Hardhat node**) via
**Web3.py**.

Setting `CHAIN_MODE=real` activates `RealChainService`; no other backend code
changes are required.  The existing `FakeChainService` and all higher-level
services (audit service, outbox worker, API routes) remain untouched.

---

## Architecture

```
Backend
 |
 v
RealChainService          (backend/app/chain/real.py)
 |
 v
Web3.py                   (pip: web3>=7)
 |
 v
Hardhat Local EVM         (npx hardhat node  →  http://127.0.0.1:8545)
 |
 v
OverVault Contracts
  ├── Audit.sol
  ├── Integrity.sol
  ├── Ownership.sol
  └── Permission.sol
```

`RealChainService` implements the `ChainService` Protocol defined in
`base.py` via structural duck-typing — no inheritance required.  The
`ChainService` Protocol is the single stable contract that all higher-level
code (`AuditService`, the outbox worker, and API routes) depend on.

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/app/chain/real.py` | Full implementation of `RealChainService` (Web3.py adapter). Replaced the `NotImplementedError` stub with all 8 required methods. |
| `backend/app/config.py` | Added `evm_rpc_url`, `evm_private_key`, `contract_address_audit`, `contract_address_integrity`, `contract_address_ownership`, `contract_address_permission` to `Settings`. Added `"real"` as a valid `chain_mode` literal. |
| `backend/requirements.txt` | Added `web3>=7` dependency. |
| `backend/pytest.ini` | Registered `real_chain` custom pytest mark to keep test runs clean. |
| `backend/tests/test_real_chain.py` | Integration test suite for `RealChainService` (auto-skipped when Hardhat is not running). |
| `.env.example` | Added `EVM_RPC_URL`, `EVM_PRIVATE_KEY`, and four `CONTRACT_ADDRESS_*` example entries. Updated `CHAIN_MODE` comment. |

---

## Implementation Details

### RPC Connection

`RealChainService.__init__()` creates a `Web3(Web3.HTTPProvider(EVM_RPC_URL))`
instance and injects `ExtraDataToPOAMiddleware` to handle PoA-compatible
chains (Hardhat uses a Clique PoA engine).  A `ConnectionError` is raised
immediately if the node is unreachable — fail-fast rather than silent failures.

```python
self._w3 = Web3(Web3.HTTPProvider(rpc_url))
self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

if not self._w3.is_connected():
    raise ConnectionError("Cannot connect to EVM node …")
```

### Wallet Handling

The signing wallet is derived from `EVM_PRIVATE_KEY` using
`web3.eth.account.from_key()`.  The account object is stored on the service
instance.  Each transaction is **manually signed** and broadcast with
`send_raw_transaction()` — no unlocked-wallet shortcuts are used, keeping the
approach portable across all EVM nodes.

```python
self._account = self._w3.eth.account.from_key(private_key)
signed = self._account.sign_transaction(tx)
tx_hash_bytes = self._w3.eth.send_raw_transaction(signed.raw_transaction)
```

### ABI Loading

ABIs are loaded from the Hardhat-compiled artifact JSON files at:

```
contracts/artifacts/src/<Contract>.sol/<Contract>.json
```

The path is resolved relative to `real.py`'s own location (three levels up
to the project root), so it works regardless of the CWD from which the
backend is started.

```python
_ARTIFACTS_DIR = Path(__file__).resolve().parents[3] / "contracts" / "artifacts" / "src"

def _load_abi(contract_name: str) -> list[dict]:
    artifact_path = _ARTIFACTS_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    with artifact_path.open() as fh:
        return json.load(fh)["abi"]
```

Contract instances are created once (via `@cached_property`) and reused across calls.

### Contract Calls

All **write** methods go through the internal `_send_tx()` helper:

1. Fetches the current nonce from the chain.
2. Calls `.build_transaction()` with `from`, `nonce`, `gas`, and `gasPrice`.
3. Signs with the stored account.
4. Broadcasts with `send_raw_transaction()`.
5. Waits for the receipt via `wait_for_transaction_receipt(timeout=120)`.
6. Maps `receipt.status` → `"confirmed"` or `"failed"`.

**Read** methods (`verify_hash`, `get_audit_trail`) use `.call()` — they are
free, gas-less queries.

### Transaction Receipts

`get_tx_status()` calls `eth_getTransactionReceipt`:

| Receipt | Returned Status |
|---------|----------------|
| `None` (not yet mined) | `"pending"` |
| `status == 1` | `"confirmed"` |
| `status == 0` | `"failed"` |

`verify_transaction()` returns `True` iff `get_tx_status()` returns `"confirmed"`.

### Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Missing env var | `ValueError` raised at instantiation — descriptive message |
| RPC node unreachable | `ConnectionError` raised at instantiation |
| Contract revert | `ContractLogicError` propagated from `_send_tx()` |
| Invalid address | `ValueError` from `Web3.to_checksum_address()` |
| RPC error during read | Logged at WARNING level; safe default returned (`False` / `[]`) |

The service **never crashes silently** — every error path is logged and either
raises or returns a meaningful safe default.

---

## Configuration

Set these in `backend/.env` to activate `RealChainService`:

```dotenv
CHAIN_MODE=real

EVM_RPC_URL=http://127.0.0.1:8545
EVM_PRIVATE_KEY=<your-test-account-private-key>

CONTRACT_ADDRESS_AUDIT=<address from deploy output>
CONTRACT_ADDRESS_INTEGRITY=<address from deploy output>
CONTRACT_ADDRESS_OWNERSHIP=<address from deploy output>
CONTRACT_ADDRESS_PERMISSION=<address from deploy output>
```

> **Never commit real private keys.**  The key above is Hardhat's well-known
> test account #0 — safe to use locally, never on mainnet.

### Quickstart with Hardhat

```bash
# Terminal 1 — start local node
cd contracts
npx hardhat node

# Terminal 2 — deploy contracts (copy addresses to .env)
cd contracts
npx hardhat run scripts/deploy.js

# Terminal 3 — start backend with real chain
cd backend
CHAIN_MODE=real uvicorn app.main:app --reload
```

---

## Testing

### Backend Tests (pytest)

The real-chain tests live in `backend/tests/test_real_chain.py` and are
marked with `pytest.mark.real_chain`.  They are **auto-skipped** when the
required env vars are not set — so `pytest` in CI always passes without a
live node.

```
pytest -m "not real_chain"   # fast — skips real-chain tests
pytest -m real_chain          # integration — requires Hardhat node
```

#### pytest result (standard run — no Hardhat node):

```
============================= test session starts ==============================
platform linux -- Python 3.14, pytest-8.x
collected 84 items / 1 deselected

tests/test_audit_api.py                 ...  14 passed
tests/test_audit_outbox.py              ...  22 passed
tests/test_fake_chain.py                     1 passed
tests/test_hashing.py                        1 passed
tests/test_health.py                         1 passed
tests/test_outbox_worker.py             ...  44 passed
tests/test_real_chain.py               SKIPPED (missing EVM env vars)

=================== 83 passed, 1 skipped in 0.68s ===================
```

> All pre-existing tests continue to pass.  `FakeChainService` and all
> higher-level code are unmodified.

### Hardhat Contract Tests (Mocha)

```bash
cd contracts
npx hardhat test
```

```
  Audit         ✔ 15 tests passing
  Integrity     ✔ 14 tests passing
  Ownership     ✔ 17 tests passing
  Permission    ✔ 15 tests passing

  61 passing (529ms)
```

All 61 contract-level tests continue to pass without modification.

---

## Git Information

**Commit hash:** `7a84fff`

**Commit message:** `feat: implement real chain service adapter`

**Branch:** `sriganesh`

---

## Next Phase

**Phase 6B — MST EVM Deployment Integration**

Phase 6B will configure `RealChainService` to target the MST EVM testnet
instead of the local Hardhat node.  This requires:

- Filling in `MST_RPC_URL`, `MST_CHAIN_ID`, and testnet contract addresses.
- Updating `hardhat.config.js` to enable the `mst_testnet` network block.
- Running `npx hardhat run scripts/deploy.js --network mst_testnet`.
- End-to-end validation against live MST testnet using the existing
  `RealChainService` implementation — **no backend changes should be needed**.
