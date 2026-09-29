# Mainnet Promotion Checklist (Future — Out of v1 Scope)

This checklist applies when migrating OverVault from MST Testnet to MST Mainnet.

---

## Pre-Launch

- [ ] **Contract Audit** — Third-party audit of all smart contracts
- [ ] **Key Management Plan** — Hardware wallet for backend signer, multi-sig for contract owner
- [ ] **Gas & Cost Budget** — Estimate monthly $MSTC costs for expected transaction volume
- [ ] **Rollback Plan** — Documented procedure to revert to testnet if issues arise
- [ ] **Data Migration** — Strategy for migrating existing testnet hash commitments

## Infrastructure

- [ ] **Environment Variables** — Update `CHAIN_MODE=real`, `MST_RPC_URL`, `MST_CHAIN_ID`
- [ ] **Backend Signer Key** — Secure storage (KMS, HSM, or hardware wallet)
- [ ] **MSTScan Base URL** — Update to mainnet explorer
- [ ] **Rate Limiting** — Implement API rate limits for production traffic
- [ ] **Monitoring** — Chain transaction success rate, outbox queue depth, API latency

## Security

- [ ] **JWT Secret Rotation** — Use a cryptographically random 256-bit secret
- [ ] **Master Key Rotation** — Rotate encryption master key and re-encrypt stored files
- [ ] **CORS Lockdown** — Restrict to production domain only
- [ ] **TLS Everywhere** — HTTPS for frontend and API, WSS for any websocket connections
- [ ] **WAF / DDoS Protection** — Cloud provider WAF rules

## Validation

- [ ] **End-to-End Test on Mainnet** — Full upload → verify → grant → audit flow
- [ ] **Load Test** — Verify performance under expected concurrent users
- [ ] **Failover Test** — Simulate chain RPC failure, verify graceful degradation

---

> **Status:** Not applicable for v1 demo. Documented for future reference.
