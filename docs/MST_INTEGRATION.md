# OverVault — MST Testnet Blockchain Integration

> **Status:** ✅ Complete and verified live on MST Testnet (Chain ID 91562037)
> **Date:** 2026-09-29

---

## Overview

Two distinct problems were solved across two sessions to wire OverVault's
backend to the **MST Testnet EVM blockchain**:

| Session | Problem | Resolution |
|---------|---------|------------|
| 1 | `RealChainService` was all `NotImplementedError` stubs | Implemented all 7 chain methods against real MST RPC |
| 2 | DB column `blockchain_tx_hash` missing; broken Alembic state; insecure JWT | Created migration, fixed Alembic, upgraded JWT secret |

---

## Session 1 — Implementing `RealChainService`

### Problem

`backend/app/chain/real.py` existed but every method raised:

```python
raise NotImplementedError
```

`CHAIN_MODE=real` was set in `.env`, meaning the app crashed on every request.

### Pre-Flight Checks

```
MST RPC URL   : https://testnetrpc.mstblockchain.com
Chain ID      : 91562037 ✅ confirmed via web3.eth.chain_id
Signer wallet : 0x8D980974EFc134749E397178359e9356052F5409
Balance       : 9.9609 MST ✅ sufficient for gas
```

Contract bytecode confirmed at all four deployed addresses:

| Contract | Address |
|----------|---------|
| Audit | `0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb` |
| Integrity | `0x5e724C47DCEccC41902f2D129091faf6D1D833AB` |
| Ownership | `0x53017dd1A227a7Fcf7665C59B7E3360995dCB148` |
| Permission | `0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E` |

Contract ABIs were reconstructed from `contracts/src/*.spec.md` and embedded
directly in `real.py` as fallback, with file-based artifact loading as primary.

### What Was Built

**File:** `backend/app/chain/real.py` (545 lines)

#### Initialization

- Resolves RPC URL: `MST_RPC_URL` → `EVM_RPC_URL` → hardcoded default
- Resolves private key: `MST_BACKEND_SIGNER_KEY` → `MST_PRIVATE_KEY` → `EVM_PRIVATE_KEY`
- Resolves contract addresses: constructor arg → `CONTRACT_ADDRESS_*` env var → `deployed.testnet.json`
- Connects via `Web3.HTTPProvider` with `ExtraDataToPOAMiddleware` (required for PoA chains)
- Thread-safe nonce management via `threading.Lock`

#### `_send_tx()` — Core Transaction Helper

- Fetches nonce with `"pending"` tag (prevents nonce collisions)
- Falls back to 1 Gwei if node returns gas price of 0
- Builds → signs → broadcasts raw transaction
- Waits up to 90s for receipt
- Returns `TxResult(tx_hash, status="confirmed"|"failed")`

#### Methods Implemented

| Method | Contract | Description |
|--------|----------|-------------|
| `commit_hash(file_id, version, content_hash)` | Integrity | Writes SHA-256 on-chain; idempotent (skips if already verified) |
| `verify_hash(file_id, version, content_hash)` | Integrity | Read-only check |
| `get_hash(file_id, version)` | Integrity | Retrieve committed hash |
| `register_ownership(file_id, owner_address, content_hash)` | Ownership | Registers owner; also anchors hash v1 |
| `record_permission(file_id, grantee, action, expiry)` | Permission | Calls `grantPermission` on-chain |
| `log_audit(event_type, ref, actor)` | Audit | Appends immutable audit event |
| `get_audit_trail(file_id)` | Audit | Reads all audit entries for a file |
| `get_tx_status(tx_hash)` | — | Returns `"pending"` / `"confirmed"` / `"failed"` |

#### `_safe_address()` Helper

Accepts EVM addresses directly, or derives a deterministic 20-byte address
from any string (e.g. a user ID) via `keccak256(text)[-20:]`.

### Live Verification (Session 1)

```
commit_hash  → block 5805648
  tx: 0xf6eabac62c64448d8fb0d0292e8f49fd3a0272be97877d89b0e1ef27725d8d98

log_audit    → block 5805649
  tx: 0xa1fea543ab7ca52565288376125974cb83e8b89ce105b4bc9193b8d8b09f638a

verify_hash  → True ✅
```

---

## Session 2 — Database Migration & JWT Fix

### Problem 1: `sqlalchemy.exc.ProgrammingError`

```
column files.blockchain_tx_hash does not exist
```

The `File` ORM model had `blockchain_tx_hash` but the Postgres schema didn't.
Additionally, the `alembic_version` table held a stale pointer `4d530504bb65`
from a deleted migration, causing Alembic to refuse all commands:

```
ERROR: Can't locate revision identified by '4d530504bb65'
```

### Problem 2: `InsecureKeyLengthWarning`

```
The HMAC key is 9 bytes long
```

`JWT_SECRET=change-me` in `.env` was only 9 bytes; HMAC-SHA256 requires ≥ 32.

---

### Fix 1: Alembic State Reconciliation

The broken pointer was corrected directly via SQL (safe — actual schema
already matched `0001` content exactly):

```sql
UPDATE alembic_version SET version_num = '0001';
```

### Fix 2: Migration `0002`

**File:** `backend/migrations/versions/0002_add_blockchain_tx_hash_to_files.py`

```python
revision = '0002'
down_revision = '0001'

def upgrade() -> None:
    with op.batch_alter_table('files', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'blockchain_tx_hash', sa.String(length=66), nullable=True
        ))

def downgrade() -> None:
    with op.batch_alter_table('files', schema=None) as batch_op:
        batch_op.drop_column('blockchain_tx_hash')
```

Applied with:

```bash
cd backend/
python3 -m alembic upgrade 0002
# INFO: Running upgrade 0001 -> 0002, add blockchain_tx_hash to files
```

### Schema After Migration

```
Table "public.files"
┌────────────────────┬─────────────┬──────────┐
│ Column             │ Type        │ Nullable │
├────────────────────┼─────────────┼──────────┤
│ id                 │ varchar(32) │ NOT NULL │
│ name               │ varchar(255)│ NOT NULL │
│ content_type       │ varchar(120)│ NOT NULL │
│ owner_id           │ varchar(32) │ NOT NULL │
│ protection_mode    │ varchar(20) │ NOT NULL │
│ current_version    │ integer     │ NOT NULL │
│ approved_version   │ integer     │ NULL     │
│ blockchain_tx_hash │ varchar(66) │ NULL     │ ← ADDED
│ is_deleted         │ boolean     │ NOT NULL │
│ created_at         │ timestamptz │ NOT NULL │
│ updated_at         │ timestamptz │ NOT NULL │
└────────────────────┴─────────────┴──────────┘
```

### Fix 3: JWT Secret

**File:** `.env`

```diff
-JWT_SECRET=change-me
-JWT_EXPIRES_MINUTES=60
+JWT_SECRET=bb5efbc4cad77e8b1bfbf433fd2eede0690429d8dd660e851ad2e0cfd640e96c
+JWT_EXPIRE_MINUTES=60
```

- Generated with `python3 -c "import secrets; print(secrets.token_hex(32))"`
- 64 hex chars = 32 bytes — satisfies HMAC-SHA256 minimum
- Key name corrected: `JWT_EXPIRES_MINUTES` → `JWT_EXPIRE_MINUTES` (matches `Settings` model)

---

## End-to-End Test Results

| Endpoint | Result |
|----------|--------|
| `GET /api/files` | ✅ HTTP 200 |
| `GET /api/dashboard/summary` | ✅ HTTP 200 — `"blockchain_status": "connected (real chain)"` |
| `POST /api/files` (upload) | ✅ HTTP 201 — full chain write |

### Upload Test Detail

```
File ID  : 1e5ffe8ae376422183d576510b1a8439
SHA-256  : 7dad524954beece52541fcaa9419e0f1c5f24c56f1dc790846f986cfcf8ed671

On-chain operations (all confirmed on MST Testnet):
  1. Integrity.commitHash         → confirmed
  2. Ownership.registerOwnership  → confirmed
  3. Audit.logAudit(FILE_CREATED) → confirmed

blockchain_tx_hash in DB:
  0xef577c6c7873f35f3d6d261c569c14583d9a2ece7ed4aa9e057e47c81e306665
```

---

## Upload Flow (Post-Integration)

```
POST /api/files
     │
     ├─ 1. Store bytes + metadata → PostgreSQL + storage backend
     │       └─ Compute SHA-256
     │
     ├─ 2. chain.commit_hash(file_id, v1, sha256)
     │       └─ Integrity contract → MST Testnet tx
     │       └─ files.blockchain_tx_hash = tx_hash
     │
     ├─ 3. chain.register_ownership(file_id, owner_addr, sha256)
     │       └─ Ownership contract → MST Testnet tx
     │
     ├─ 4. chain.log_audit("FILE_CREATED", file_id, actor)
     │       └─ Audit contract → MST Testnet tx
     │
     └─ 5. All tx hashes → audit_outbox table
           └─ Return FileOut with ownership_tx populated
```

> If any on-chain step fails, the upload is **preserved** — blockchain writes
> are logged as warnings but do not roll back the file record. This is
> intentional for the testnet phase.

---

## File Inventory

| File | Status | Notes |
|------|--------|-------|
| `backend/app/chain/real.py` | ✅ Fully implemented | 545 lines, all 7 chain methods |
| `backend/app/chain/__init__.py` | Pre-existing | Factory routes `CHAIN_MODE=real` correctly |
| `backend/app/chain/base.py` | Pre-existing | Protocol/dataclass definitions |
| `backend/app/config.py` | Pre-existing | All MST env vars mapped |
| `backend/migrations/versions/0002_add_blockchain_tx_hash_to_files.py` | ✅ New | Adds `blockchain_tx_hash VARCHAR(66) NULL` |
| `backend/migrations/versions/0001_initial_schema.py` | Pre-existing | Base schema (all other tables) |
| `.env` | ✅ Updated | 32-byte JWT secret, fixed key name |
| `contracts/deployed.testnet.json` | Pre-existing | All 4 contract addresses |

---

## Alembic Cheat Sheet

```bash
cd backend/

python3 -m alembic current       # show current DB revision
python3 -m alembic history       # list all migrations
python3 -m alembic upgrade head  # apply all pending migrations
python3 -m alembic downgrade -1  # roll back one migration
```

---

## Environment Variables Reference

```env
# Chain mode — must be 'real' for on-chain writes
CHAIN_MODE=real

# MST Testnet RPC
MST_RPC_URL=https://testnetrpc.mstblockchain.com
MST_CHAIN_ID=91562037

# Signing wallet (never commit real keys)
MST_BACKEND_SIGNER_KEY=0x...
MST_PRIVATE_KEY=0x...

# Deployed contracts
CONTRACT_ADDRESS_AUDIT=0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb
CONTRACT_ADDRESS_INTEGRITY=0x5e724C47DCEccC41902f2D129091faf6D1D833AB
CONTRACT_ADDRESS_OWNERSHIP=0x53017dd1A227a7Fcf7665C59B7E3360995dCB148
CONTRACT_ADDRESS_PERMISSION=0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E

# JWT (minimum 32 bytes — generate fresh for production)
# python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=<64-char-hex>
JWT_EXPIRE_MINUTES=60
```
