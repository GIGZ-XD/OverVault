# Phase 3 — Production Audit Pipeline

## Overview

OverVault has transitioned from a direct, synchronous audit logging mechanism into an asynchronous, enterprise-grade, event-driven audit pipeline. 

In production systems, direct blockchain interactions on user requests introduce latency bottlenecks and risks of dropped audit logs during transient network failures. The Phase 3 Production Audit Pipeline decouples application actions from blockchain execution using a transactional **PostgreSQL Outbox Pattern**, background worker processing with exponential backoff retries, rich on-chain transaction metadata tracking, and dedicated verification endpoints.

---

## Architecture

```
User / API Action
       │
       ▼
Audit Event Creation
       │
       ▼
PostgreSQL Outbox (AuditOutbox / AuditEvent)
       │
       ▼
Background Worker (outbox_worker)
       │
       ▼
RealChainService (Web3.py EVM Adapter)
       │
       ▼
MST EVM Blockchain (Audit, Integrity, Ownership, Permission)
       │
       ▼
Verification API (GET /audit/{file_id}/verify, GET /transaction/{tx_hash})
```

---

## Completed Features

### 1. Production Audit Event Model (`backend/app/models/audit_event.py`)
- Standardized `AuditEvent` model supporting UUID primary keys, timestamping, content hashes, flexible JSON metadata, lifecycle status, and on-chain transaction hashes.
- Comprehensive `AuditEventType` enumeration:
  - `FILE_UPLOADED`
  - `FILE_HASHED`
  - `OWNERSHIP_REGISTERED`
  - `PERMISSION_GRANTED`
  - `FILE_ACCESSED`
  - `FILE_SHARED`
  - `FILE_DELETED`
- Designed for future extensibility without schema breakage.

### 2. Transactional Database Outbox Pattern (`backend/app/models/audit_outbox.py`, `backend/app/services/outbox.py`)
- Non-blocking persistence of audit actions immediately in PostgreSQL / SQLite.
- Extended lifecycle states: `pending`, `processing`, `submitted`, `confirmed`, `retry`, `failed`, and `dead_letter`.
- Dedicated tracking of `retry_count`, `last_error`, `processed_at`, `created_at`, and `updated_at`.
- Guaranteed at-least-once delivery to the blockchain.

### 3. Worker Reliability & Exponential Backoff (`backend/app/workers/outbox_worker.py`)
- Asynchronous worker batch processing decoupled from HTTP request lifecycles.
- Structured logging with detailed event IDs, routing classifications, attempt counts, and transaction references.
- Deterministic exponential retry backoff schedule:
  - **Attempt 1:** 5 seconds
  - **Attempt 2:** 30 seconds
  - **Attempt 3:** 300 seconds (5 minutes)
  - **Attempt 4:** 1800 seconds (30 minutes)
  - **Attempt 5+:** 3600 seconds (1 hour)
- Exhausted retry attempts transition to `dead_letter` or `failed` state with persistent error diagnostics.

### 4. Extended Transaction Metadata (`backend/app/chain/base.py`, `real.py`, `fake.py`)
- Backwards-compatible `TxResult` structure enriched with:
  - `tx_hash`
  - `status` (`confirmed`, `pending`, `failed`)
  - `block_number`
  - `gas_used`
  - `confirmations`
  - `chain_id`
  - `timestamp`
- Universal `get_transaction_details(tx_hash)` interface implemented across both `RealChainService` (MST EVM) and `FakeChainService`.

### 5. Audit Verification APIs (`backend/app/api/routes/audit.py`, `backend/app/api/routes/transaction.py`)
- `GET /audit/{file_id}` — Chronological audit trail for a file.
- `GET /audit/{file_id}/verify` — Cryptographic integrity and ownership verification summary.
- `GET /transaction/{tx_hash}` — Full on-chain confirmation details and gas usage.

---

## Database Flow

### Happy Path Lifecycle:
```
[ pending ] ──► [ processing ] ──► [ submitted ] ──► [ confirmed ]
```

### Failure & Retry Lifecycle:
```
[ processing ]
       │ (Chain Error / Network Glitch)
       ▼
   [ retry ] (retry_count < MAX_RETRIES)
       │
       ▼ (Exhausted retries >= MAX_RETRIES or unrecoverable error)
 [ dead_letter ] / [ failed ]
```

---

## API Reference

### 1. `GET /audit/{file_id}`
Returns the chronological audit trail entries for a given file.

**Response `200 OK`:**
```json
[
  {
    "event_type": "FILE_UPLOADED",
    "reference_id": "file-12345",
    "actor": "0x4F1d8e...981B",
    "status": "confirmed",
    "tx_hash": "0xa6f0e4b83492582...",
    "created_at": "2026-09-29T06:00:00Z"
  }
]
```

### 2. `GET /audit/{file_id}/verify`
Returns file integrity, ownership status, audit event counts, and latest transaction anchor.

**Response `200 OK`:**
```json
{
  "file_id": "file-12345",
  "integrity": "verified",
  "ownership": "verified",
  "audit_events": 10,
  "latest_transaction": "0xa6f0e4b834925827361849204719284719284719284719284719284719284719"
}
```

### 3. `GET /transaction/{tx_hash}`
Returns on-chain verification metadata including block number, gas used, confirmations, and network chain ID.

**Response `200 OK`:**
```json
{
  "tx_hash": "0xa6f0e4b834925827361849204719284719284719284719284719284719284719",
  "status": "confirmed",
  "block_number": 89421,
  "gas_used": 47210,
  "confirmations": 12,
  "chain_id": 1337,
  "timestamp": 1727560000
}
```

---

## Validation Results

### Backend Test Suite
```bash
cd backend
pytest -rs
```

**Result:**
```
================== 132 passed, 1 warning in 108.39s ==================
```

### MST Testnet Connection & Real Chain Validation
```bash
pytest -m mst_connection -rs
# 11 passed

pytest -m mst_real_chain -rs
# 6 passed
```

---

## Previous Phase Reference

- **Phase 2 & Phase 6A/6B/6C (RealChain Integration):**
  - Live MST Testnet RPC connection configured (`https://rpc.testnet.mst.xyz` / `CHAIN_ID=1337`).
  - Web3.py production adapter with dynamic gas estimation buffer (+50,000 gas).
  - Deployed smart contracts (`Audit`, `Integrity`, `Ownership`, `Permission`).
  - Real EVM on-chain transaction execution and cryptographic hash verification.
