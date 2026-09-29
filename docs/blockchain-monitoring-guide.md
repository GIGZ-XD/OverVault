# Blockchain Operational Monitoring Guide

## Overview
This guide describes the operational monitoring layer for OverVault's blockchain integration, detailing metrics collection, outbox health checks, alerting thresholds, and troubleshooting procedures.

---

## 1. Monitoring Architecture

OverVault provides an internal monitoring service (`app.services.blockchain_monitor`) that aggregates metrics from PostgreSQL outbox records and active blockchain transactions.

```text
+-------------------+        +-------------------------+        +-------------------+
|  Outbox Worker    | -----> | PostgreSQL audit_outbox | <----- | Blockchain Monitor|
+-------------------+        +-------------------------+        +-------------------+
                                                                          |
                                                                          v
                                                                +-------------------+
                                                                | Monitoring APIs   |
                                                                | & Prometheus/Logs |
                                                                +-------------------+
```

---

## 2. Core Operational Metrics

### 2.1 Queue & Backlog Metrics
- **Pending Transactions (`get_pending_transactions`):** Tracks records currently waiting in `pending`, `processing`, `submitted`, or `retry` states.
  - *Threshold Alert:* Pending count > 500 for > 5 minutes indicates worker starvation or RPC throttling.

### 2.2 Failure & Dead-Letter Tracking
- **Failed Transactions (`get_failed_transactions`):** Captures events that have exhausted retry attempts or encountered unrecoverable errors.
  - *Threshold Alert:* Any row moving to `failed` or `dead_letter` triggers an alert.

### 2.3 Confirmation Latency
- **Confirmation Duration (`get_confirmation_metrics`):**
  - Average confirmation time in seconds ($T_{\text{processed}} - T_{\text{created}}$).
  - Success rate percentage ($\frac{N_{\text{confirmed}}}{N_{\text{confirmed}} + N_{\text{failed}}} \times 100\%$).
  - *Target SLA:* Average confirmation latency < 10 seconds on MST Mainnet.

### 2.4 Gas Usage Analytics
- **Gas Benchmark Tracking (`get_gas_metrics`):**
  - Aggregates estimated gas consumption across all transaction types (`Audit.logAudit`: ~45k, `Integrity.commitHash`: ~55k, `Ownership.registerOwnership`: ~58k).
  - Helps budget gas relayer wallet funding requirements.

---

## 3. Monitoring API & CLI Verification

### Programmatic Python Usage
```python
from app.services.blockchain_monitor import (
    get_confirmation_metrics,
    get_failed_transactions,
    get_gas_metrics,
    get_pending_transactions,
)

# Fetch metrics with an active DB session
conf_stats = get_confirmation_metrics(db)
gas_stats = get_gas_metrics(db)
print(f"Success rate: {conf_stats['success_rate_percent']}%")
print(f"Total gas consumed: {gas_stats['estimated_total_gas_consumed']}")
```

### Verification via REST API
```bash
# Query status of a specific blockchain transaction
curl -X GET "http://localhost:8000/transaction/0x5a1b2c3d..."
```
*Response:*
```json
{
  "tx_hash": "0x5a1b2c3d...",
  "contract": "Audit.sol",
  "event": "AuditLogged",
  "status": "confirmed",
  "block_number": 120045,
  "gas_used": 45000,
  "confirmations": 24,
  "chain_id": 1337,
  "timestamp": 1759104000
}
```

---

## 4. Incident Troubleshooting Runbook

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **High pending queue** | Worker down or low batch size | Check worker process logs; increase `OUTBOX_BATCH_SIZE`. |
| **RPC timeout errors** | Node congestion or latency | Increase `TX_TIMEOUT_SECONDS`; switch to secondary RPC endpoint. |
| **Insufficient funds errors** | Relayer wallet depleted | Top up native MST balance in the backend worker account. |
| **Nonce collision / stall** | Multiple workers sharing single wallet | Ensure worker instances use serialized queue workers or unique signing addresses. |
