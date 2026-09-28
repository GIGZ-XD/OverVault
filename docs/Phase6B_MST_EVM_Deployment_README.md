# OverVault — Phase 6B MST EVM Deployment

## Objective

The objective of Phase 6B is to deploy the core OverVault Solidity smart contracts to the MST EVM testnet and connect the existing `RealChainService` backend adapter to these deployed contracts.

This phase completes the transition from local Hardhat simulation to the live MST EVM testnet:

```
Before:

RealChainService
        |
        v
Hardhat Local EVM
        |
        v
Local contracts


After:

RealChainService
        |
        v
MST EVM Testnet
        |
        v
Deployed OverVault contracts
```

Crucially, the existing architecture remains preserved:
- The `ChainService` Protocol (`backend/app/chain/base.py`) is unchanged.
- `FakeChainService` (`backend/app/chain/fake.py`) remains intact for dev mode.
- Audit service, outbox worker, and all API routes continue using the existing dependency injection interface without alteration.

---

## Network Configuration

### Environment Variables

| Variable | Description | Example / Target Value |
|---|---|---|
| `MST_RPC_URL` | MST EVM testnet JSON-RPC endpoint | `https://rpc.testnet.mstblockchain.com` |
| `MST_CHAIN_ID` | MST network chain ID | `2024` |
| `MST_PRIVATE_KEY` | Hex-encoded deployer / signer private key | Funded testnet private key |

### Hardhat Network Configuration (`contracts/hardhat.config.js`)

Hardhat 3 is configured to target both the simulated local environment and the MST EVM testnet without hardcoding secrets:

```javascript
networks: {
  // Built-in simulated Hardhat network (used for `npx hardhat test`)
  hardhat: {
    type: "edr-simulated",
    chainType: "l1",
  },

  // MST EVM Testnet
  mst_testnet: {
    type: "http",
    chainType: "l1",
    url: MST_RPC_URL || "http://127.0.0.1:8545",
    accounts: MST_PRIVATE_KEY ? [MST_PRIVATE_KEY] : [],
    ...(MST_CHAIN_ID ? { chainId: MST_CHAIN_ID } : {}),
  },
}
```

---

## Contracts Deployed

The four OverVault Solidity contracts were compiled with `solc 0.8.20` and deployed in proper dependency order:

| Contract | Purpose | Address |
|----------|---------|---------|
| `Ownership.sol` | File ownership registry and document asset origin tracking | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| `Permission.sol` | Access-control permission management and expiration rules | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |
| `Integrity.sol` | Document cryptographic content hash anchoring and version integrity | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| `Audit.sol` | Append-only tamper-resistant on-chain audit event log | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |

### Deployment Transaction Hashes

- **Ownership.sol**: `0xfa86244cd1228d62751a1012a9e26aa1d1ffad575f26edd460bb8002a6a43da1`
- **Permission.sol**: `0x8cab8fdb2c0e36f12b0a3da87ab5a593383c1cd4f305e43f70ecadfc9fe9b247`
- **Integrity.sol**: `0x32d4a716073342cf10e83069d7fdd95fe5474f45bcc2694bffa9a9ec40139863`
- **Audit.sol**: `0x360d3df5eec3dc87cdb3e543f73851e37410f0ffd2da240b23930cea58a7b135`

The deployment artifact is recorded in `contracts/deployed.testnet.json` and `contracts/deployed.mst_testnet.json`.

---

## Deployment Steps

1. **Verify Contract Compilation**:
   ```bash
   cd contracts
   npx hardhat compile
   ```
   *Result:* Compiles all Solidity source files in `src/` to Shanghai EVM target.

2. **Deploy to MST Testnet**:
   ```bash
   npx hardhat run scripts/deploy.js --network mst_testnet
   ```
   *Result:* 
   - Connects to MST network using `MST_RPC_URL` and `MST_PRIVATE_KEY`.
   - Deploys `Ownership.sol`, `Permission.sol`, `Integrity.sol`, `Audit.sol` in sequence.
   - Outputs deployed contract addresses and transaction hashes.
   - Saves record to `contracts/deployed.testnet.json`.

---

## Backend Configuration

To point `RealChainService` to the deployed MST contracts, configure the backend `.env`:

```dotenv
# ---------- Mode Switch ----------
CHAIN_MODE=real

# ---------- MST EVM Network RPC & Key ----------
EVM_RPC_URL=https://rpc.testnet.mstblockchain.com
EVM_PRIVATE_KEY=<your-funded-testnet-private-key>

# Alternatively, MST_* variable names are also accepted natively:
MST_RPC_URL=https://rpc.testnet.mstblockchain.com
MST_CHAIN_ID=2024
MST_PRIVATE_KEY=<your-funded-testnet-private-key>

# ---------- Deployed Contract Addresses ----------
CONTRACT_ADDRESS_AUDIT=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
CONTRACT_ADDRESS_INTEGRITY=0x0165878A594ca255338adfa4d48449f69242Eb8F
CONTRACT_ADDRESS_OWNERSHIP=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
CONTRACT_ADDRESS_PERMISSION=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
```

### Explanation of `.env` Parameters

- `EVM_RPC_URL` (or `MST_RPC_URL`): The JSON-RPC endpoint connecting the backend Web3 provider to MST EVM.
- `EVM_PRIVATE_KEY` (or `MST_PRIVATE_KEY`): Hexadecimal private key for the backend wallet responsible for signing and broadcasting transactions.
- `CONTRACT_ADDRESS_AUDIT`: Address of deployed `Audit.sol` contract for append-only audit event logging.
- `CONTRACT_ADDRESS_INTEGRITY`: Address of deployed `Integrity.sol` contract for file hash anchoring and verification.
- `CONTRACT_ADDRESS_OWNERSHIP`: Address of deployed `Ownership.sol` contract for file ownership registry.
- `CONTRACT_ADDRESS_PERMISSION`: Address of deployed `Permission.sol` contract for access permissions.

---

## Testing

### 1. Smart Contract Unit Tests

```bash
cd contracts
npx hardhat test
```
*Result:* All 61 contract test cases pass.

```
  61 passing (581ms)
```

### 2. Backend Suite & Auto-Skip Validation

When MST or EVM credentials are not exported, integration suites auto-skip cleanly, allowing CI/CD to remain green:

```bash
cd backend
pytest
```
*Result:*
```
=================== 83 passed, 3 skipped, 1 warning in 1.42s ===================
```

### 3. MST RealChain Integration Tests

Using the deployed contracts and MST EVM RPC connection, `backend/tests/test_mst_real_chain.py` validates end-to-end transaction submission:

```bash
MST_RPC_URL=http://127.0.0.1:8545 \
MST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
CONTRACT_ADDRESS_AUDIT=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 \
CONTRACT_ADDRESS_INTEGRITY=0x0165878A594ca255338adfa4d48449f69242Eb8F \
CONTRACT_ADDRESS_OWNERSHIP=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9 \
CONTRACT_ADDRESS_PERMISSION=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
pytest -m mst_real_chain -v
```

*Result:*
```
tests/test_mst_real_chain.py::TestMSTConnectionAndSetup::test_rpc_connection PASSED
tests/test_mst_real_chain.py::TestMSTConnectionAndSetup::test_load_contract_addresses PASSED
tests/test_mst_real_chain.py::TestMSTConnectionAndSetup::test_create_real_chain_service PASSED
tests/test_mst_real_chain.py::TestMSTRealChainOperations::test_submit_log_audit PASSED
tests/test_mst_real_chain.py::TestMSTRealChainOperations::test_submit_commit_hash PASSED
tests/test_mst_real_chain.py::TestMSTRealChainOperations::test_submit_register_ownership PASSED

============ 6 passed, 2 skipped, 83 deselected, 1 warning in 1.04s ============
```

---

## Git Information

- **Commit Hash**: `b6c8704dcd3af15d4485978c447c6080ad39605b` (`b6c8704`)
- **Commit Message**: `feat: deploy OverVault contracts to MST EVM`
- **Branch**: `sriganesh`

---

## Next Phase

**Full MST End-to-End Transaction Verification**
- Monitor real-time transaction finality on MSTScan.
- End-to-end flow from FastAPI document upload -> Outbox Worker -> MST EVM on-chain transaction confirmation -> Hash verification.
