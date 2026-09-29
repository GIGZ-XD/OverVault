# OverVault — Phase 5: Smart Contracts

## Objective

Implement the on-chain contract layer for OverVault.

The four Solidity contracts form the permanent, tamper-proof record layer of the system:

- **Integrity.sol** — anchors document content hashes on-chain for versioned integrity verification
- **Audit.sol** — maintains an append-only, immutable audit log of all application events
- **Ownership.sol** — tracks which Ethereum address owns each file
- **Permission.sol** — manages time-limited access grants per file, grantee, and action

These contracts sit beneath `RealChainService` in the backend architecture. Application code never calls them directly — all interaction is mediated through the `ChainService` abstraction layer built in earlier phases.

---

## Implementation Summary

### Contracts Created

| Contract | Responsibility |
|---|---|
| `Integrity.sol` | Commit and verify document content hashes per (fileId, version) |
| `Audit.sol` | Append-only log of application events; indexed by referenceId |
| `Ownership.sol` | Map fileId → owner address; support initial registration and transfer |
| `Permission.sol` | Grant/revoke time-limited access (fileId, grantee, action, expiry) |

### How They Connect to ChainService

```
Backend application code
        │
        ▼
ChainService (abstract base — backend/app/chain/base.py)
        │
        ├── FakeChainService (testing/dev — backend/app/chain/fake.py)
        │
        └── RealChainService (Phase 6 — backend/app/chain/real.py)
                │
                ▼
        Web3 / MST SDK
                │
                ▼
        OverVault Smart Contracts (this phase)
                │
                ▼
        MST EVM Blockchain
```

The `ChainService` methods map directly onto contract functions:

| ChainService method | Contract function |
|---|---|
| `commit_hash(file_id, version, hash)` | `Integrity.commitHash()` |
| `verify_transaction(tx_hash)` | `Integrity.verifyHash()` |
| `register_ownership(file_id, owner)` | `Ownership.registerOwnership()` |
| `record_permission(file_id, grantee, action, expiry)` | `Permission.grantPermission()` |
| `log_audit(event_type, ref_id, actor)` | `Audit.logAudit()` |

### Important Solidity Design Decisions

| Decision | Rationale |
|---|---|
| **Custom errors** (`revert EmptyArgument("fileId")`) | Gas-efficient and machine-parseable; enable `revertedWithCustomError` assertions in tests |
| **`calldata` for string args** | Avoids copying string data to memory on read-only parameters; saves gas |
| **`keccak256` for hash comparison in `verifyHash`** | Solidity cannot directly compare `string` values; hashing both sides and comparing hashes is idiomatic |
| **Append-only `Audit._entries` array** | No delete or update functions exist; immutability is structural, not just documented |
| **Dual-index in `Audit`** (global array + per-refId mapping) | Allows both `getEntry(index)` and `getEntriesForRef(fileId)` without iterating all entries |
| **`expiry == 0` means never expires** | Avoids the need for a separate `permanent` flag; simplifies the grant call |
| **`Permission` allows re-grant** | Overwriting an existing record updates the expiry; makes extending/tightening access simple without a separate update function |
| **`Ownership.transferOwnership` is owner-only** | Only the on-chain registered owner can transfer; prevents unauthorised transfers |

---

## Files Changed

| File | Changes |
|---|---|
| [`contracts/src/Integrity.sol`](../contracts/src/Integrity.sol) | Full implementation — commitHash, verifyHash, getHash, getLatestVersion, isCommitted |
| [`contracts/src/Audit.sol`](../contracts/src/Audit.sol) | Full implementation — logAudit, getEntry, getEntriesForRef, totalEntries |
| [`contracts/src/Ownership.sol`](../contracts/src/Ownership.sol) | Full implementation — registerOwnership, getOwner, isRegistered, transferOwnership |
| [`contracts/src/Permission.sol`](../contracts/src/Permission.sol) | Full implementation — grantPermission, checkPermission, getPermission, revokePermission |
| [`contracts/hardhat.config.js`](../contracts/hardhat.config.js) | Hardhat 3 config — mocha-ethers toolbox, Solidity 0.8.20, sources path, MST EVM placeholder |
| [`contracts/package.json`](../contracts/package.json) | Isolated npm project for contracts; Hardhat 3 + mocha-ethers toolbox |
| [`contracts/scripts/deploy.js`](../contracts/scripts/deploy.js) | Deploy all four contracts and print addresses + env var hints |
| [`contracts/test/Integrity.test.js`](../contracts/test/Integrity.test.js) | 15 tests — commitHash, verifyHash, getLatestVersion, isCommitted |
| [`contracts/test/Audit.test.js`](../contracts/test/Audit.test.js) | 15 tests — logAudit, getEntry, getEntriesForRef, append-only integrity |
| [`contracts/test/Ownership.test.js`](../contracts/test/Ownership.test.js) | 16 tests — registerOwnership, getOwner, isRegistered, transferOwnership |
| [`contracts/test/Permission.test.js`](../contracts/test/Permission.test.js) | 15 tests — grantPermission, checkPermission, getPermission, revokePermission |

---

## Contract Documentation

### `Integrity.sol`

**Purpose:** Anchor document content hashes on-chain. Each (fileId, version) maps to exactly one content hash. Re-committing a version is rejected.

**Storage:**
```solidity
mapping(string => mapping(uint256 => string)) private _hashes;       // fileId → version → hash
mapping(string => mapping(uint256 => bool))   private _committed;    // committed flag
mapping(string => uint256)                     private _latestVersion; // latest committed version
```

**Public functions:**

| Function | Description |
|---|---|
| `commitHash(fileId, version, contentHash)` | Stores hash; rejects duplicates; updates latest version pointer; emits `HashCommitted` |
| `verifyHash(fileId, version, contentHash)` | Returns `true` if stored hash matches provided hash (keccak256 comparison) |
| `getHash(fileId, version)` | Returns raw stored hash string |
| `getLatestVersion(fileId)` | Returns highest committed version number (0 if none) |
| `isCommitted(fileId, version)` | Returns whether a version has been committed |

**Events:**
```solidity
event HashCommitted(string indexed fileId, uint256 version, string contentHash, uint256 timestamp);
```

---

### `Audit.sol`

**Purpose:** Append-only, immutable audit log. Records every application action permanently on-chain. No update or delete functions exist.

**Storage:**
```solidity
struct AuditEntry { string eventType; string referenceId; string actor; uint256 timestamp; }
AuditEntry[] private _entries;                             // global append-only array
mapping(string => uint256[]) private _entriesByRef;        // referenceId → entry indices
```

**Public functions:**

| Function | Description |
|---|---|
| `logAudit(eventType, referenceId, actor)` | Appends new entry; indexes by referenceId; emits `AuditLogged` |
| `getEntry(index)` | Returns `(eventType, referenceId, actor, timestamp)` for a global index |
| `getEntriesForRef(referenceId)` | Returns all entry indices for a given referenceId |
| `totalEntries()` | Returns total number of entries globally |

**Events:**
```solidity
event AuditLogged(uint256 indexed index, string eventType, string indexed referenceId, string actor, uint256 timestamp);
```

---

### `Ownership.sol`

**Purpose:** On-chain file ownership registry. Maps fileId to a single Ethereum address. Supports initial registration and owner-only transfer.

**Storage:**
```solidity
mapping(string => address) private _owners;       // fileId → owner address
mapping(string => bool)    private _registered;   // registered flag
```

**Public functions:**

| Function | Description |
|---|---|
| `registerOwnership(fileId, owner)` | Registers initial owner; rejects if already registered; emits `OwnershipRegistered` |
| `getOwner(fileId)` | Returns owner address (zero address if unregistered) |
| `isRegistered(fileId)` | Returns whether fileId has a registered owner |
| `transferOwnership(fileId, newOwner)` | Transfers to new owner; caller must be current owner; emits `OwnershipTransferred` |

**Events:**
```solidity
event OwnershipRegistered(string indexed fileId, address indexed owner, uint256 timestamp);
event OwnershipTransferred(string indexed fileId, address indexed previousOwner, address indexed newOwner, uint256 timestamp);
```

---

### `Permission.sol`

**Purpose:** Tracks access permissions per (fileId, grantee, action). Supports time-limited expiry (0 = never expires). Permissions can be overwritten or explicitly revoked.

**Storage:**
```solidity
struct PermissionRecord { string action; uint256 expiry; bool exists; }
mapping(string => mapping(address => mapping(string => PermissionRecord))) private _permissions;
```

**Public functions:**

| Function | Description |
|---|---|
| `grantPermission(fileId, grantee, action, expiry)` | Grants (or overwrites) a permission; emits `PermissionGranted` |
| `checkPermission(fileId, grantee, action)` | Returns `true` if permission exists and has not expired |
| `getPermission(fileId, grantee, action)` | Returns raw `(exists, expiry)` record |
| `revokePermission(fileId, grantee, action)` | Deletes record; reverts if not found; emits `PermissionRevoked` |

**Events:**
```solidity
event PermissionGranted(string indexed fileId, address indexed grantee, string action, uint256 expiry, uint256 timestamp);
event PermissionRevoked(string indexed fileId, address indexed grantee, string action, uint256 timestamp);
```

---

## Deployment

### Hardhat Setup

The `contracts/` directory is an isolated npm project running **Hardhat 3.18.0** with the `@nomicfoundation/hardhat-toolbox-mocha-ethers` plugin.

```
contracts/
├── src/                  ← Solidity contracts (sources path)
├── test/                 ← Mocha+Ethers tests
├── scripts/deploy.js     ← Deployment script
├── hardhat.config.js     ← Hardhat 3 configuration
├── package.json          ← Isolated npm project
└── artifacts/            ← Compiled output (auto-generated)
```

Install dependencies:
```bash
cd contracts
npm install
```

### Deploy Script

[`contracts/scripts/deploy.js`](../contracts/scripts/deploy.js) deploys all four contracts sequentially and prints:
- Deployed addresses
- JSON summary
- `backend/.env` variable hints for `RealChainService`

### Network Configuration

**Local Hardhat (default — for testing):**
```bash
npx hardhat test
```

**Future MST EVM testnet** (configured but commented out in `hardhat.config.js`):
```javascript
// mst_testnet: {
//   type: "http",
//   chainType: "l1",
//   url: process.env.MST_EVM_RPC_URL ?? "",
//   accounts: process.env.MST_DEPLOYER_PRIVATE_KEY
//     ? [process.env.MST_DEPLOYER_PRIVATE_KEY]
//     : [],
// },
```

To deploy to MST EVM:
1. Uncomment the `mst_testnet` block in `hardhat.config.js`
2. Set env vars: `MST_EVM_RPC_URL`, `MST_DEPLOYER_PRIVATE_KEY`
3. Run: `npx hardhat run scripts/deploy.js --network mst_testnet`

---

## Testing

**Command:**
```bash
cd contracts
npx hardhat test
```

**Results:**

| Metric | Count |
|---|---|
| ✅ Passed | **61** |
| ❌ Failed | 0 |
| ⚠️ Warnings | 0 |

**Test breakdown:**

| Test file | Tests | Coverage |
|---|---|---|
| `test/Integrity.test.js` | 15 | commitHash, verifyHash, getLatestVersion, isCommitted, error cases |
| `test/Audit.test.js` | 15 | logAudit, getEntry, getEntriesForRef, append-only guarantee, error cases |
| `test/Ownership.test.js` | 16 | registerOwnership, getOwner, isRegistered, transferOwnership, error cases |
| `test/Permission.test.js` | 15 | grantPermission, checkPermission (valid/expired/future), getPermission, revokePermission, error cases |

---

## Git Information

**Commit:** `3a63e26`

**Message:** `feat: implement overvault smart contracts`

**Branch:** `sriganesh`

**Files in commit:** 37 files (4 contracts in `src/`, 4 test files, deploy script, Hardhat config, `package.json`, compiled artifacts, TypeChain types)

---

## Architecture Flow

```
Application (FastAPI backend)
        │
        ▼
ChainService (backend/app/chain/base.py)
  Abstract interface: commit_hash, verify_transaction,
  register_ownership, record_permission, log_audit
        │
        ├── FakeChainService (backend/app/chain/fake.py)
        │   In-memory implementation for dev/testing
        │
        └── RealChainService (backend/app/chain/real.py) [Phase 6]
                │
                ▼
        MST SDK / Web3.py
                │
                ▼
        OverVault Smart Contracts (contracts/src/)
          ┌──────────────┐  ┌──────────────┐
          │ Integrity.sol│  │   Audit.sol  │
          │ commitHash() │  │  logAudit()  │
          │ verifyHash() │  │  getEntry()  │
          └──────────────┘  └──────────────┘
          ┌──────────────┐  ┌──────────────┐
          │Ownership.sol │  │Permission.sol│
          │registerOwner │  │grantPermiss. │
          │getOwner()    │  │checkPermiss. │
          └──────────────┘  └──────────────┘
                │
                ▼
        MST EVM Blockchain (immutable on-chain state)
```

---

## Next Phase

**Phase 6 — RealChainService MST EVM Integration**

Wire `backend/app/chain/real.py` to the deployed smart contracts:

1. Use the MST SDK / Web3.py to connect to MST EVM
2. Load contract ABIs from `contracts/artifacts/src/*/`
3. Implement each `ChainService` abstract method by calling the corresponding contract function
4. Map contract transaction receipts to `tx_hash` strings for the outbox worker
5. Configure deployer private key and contract addresses via `backend/.env`
6. Swap `FakeChainService` → `RealChainService` in `backend/app/deps.py`

Supporting work:
- Add integration tests against a forked/local MST EVM node
- Add `contracts/scripts/verify.js` to verify deployed contracts on MST EVM explorer
