# OverVault Mainnet Promotion Checklist

This document outlines the required production-readiness criteria before deploying OverVault from MST Testnet to MST Mainnet.

---

### 1. Smart Contract Readiness & Audit
- [ ] Complete formal security audit of OverVault Solidity contracts by a third-party firm.
- [ ] Implement upgradeability pattern (e.g. OpenZeppelin UUPS or Transparent Proxy) with multi-sig governance.
- [ ] Verify contracts on MST Mainnet block explorer with published source code.
- [ ] Test contract deployment scripts under Mainnet gas conditions.

### 2. Key Management & Custody
- [ ] Move outbox worker signing key from environment variables to a dedicated Hardware Security Module (HSM) or Cloud KMS (e.g. AWS KMS / HashiCorp Vault).
- [ ] Configure multi-signature approval (Gnosis Safe / MST equivalent) for contract admin functions.
- [ ] Establish automated key rotation procedures.

### 3. Outbox Worker & Blockchain Resilience
- [ ] Replace in-process polling with a resilient background worker (e.g. Celery / Temporal).
- [ ] Implement exponential backoff retry with dead-letter queue (DLQ) for failed blockchain transactions.
- [ ] Add gas price dynamic estimation and replacement transactions (speed up / cancel) for stuck mempool transactions.
- [ ] Maintain an emergency circuit breaker to pause blockchain submissions if gas exceeds safe thresholds.

### 4. Storage & Encryption Hardening
- [ ] Migrate local filesystem storage to S3-compatible object storage with server-side encryption (SSE-KMS) and object lock (WORM).
- [ ] Implement envelope encryption (unique DEK per file, encrypted with master KEK).
- [ ] Configure automatic lifecycle rules for version archiving and compliance retention.

### 5. Infrastructure & Operations
- [ ] Deploy backend on containerized orchestration (Kubernetes / ECS) with auto-scaling.
- [ ] Configure PostgreSQL with automated backups, point-in-time recovery (PITR), and read replicas.
- [ ] Set up Prometheus/Grafana dashboards for outbox backlog, chain latency, and API p99 response times.
- [ ] Implement rate limiting, WAF, and DDoS mitigation.
