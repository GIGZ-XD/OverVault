# Phase 2 — RealChain Integration

## Overview

Phase 2 connects OverVault to the real MST EVM blockchain network using Web3.py, replacing mock/fake chain operations with production-grade on-chain execution and verifiable transaction lifecycle management.

---

## Completed Features

- **RealChainService**: Web3.py-backed service adapter implementing the complete `ChainService` protocol.
- **MST RPC Connection**: HTTPProvider connectivity with PoA middleware injection for EVM compatibility.
- **Wallet Signing**: Local transaction signing and nonce management via private key.
- **Smart Contract Interaction**: End-to-end contract calls for all core OverVault features.
- **ABI Loading from Hardhat Artifacts**: Automatic resolution of compiled contract ABIs directly from `contracts/artifacts/`.
- **Audit Contract Integration**: Append-only event logging with indexed reference IDs and queryable audit trails.
- **Integrity Hash Anchoring**: Document version content hash anchoring (`commitHash`) and cryptographic verification (`verifyHash`).
- **Ownership Registration**: Immutable registration of document asset ownership on-chain.
- **Permission Recording**: Granular permission grant and revocation management with time-based expiry support.
- **Transaction Confirmation Tracking**: Receipt polling and deterministic confirmation status reporting (`TxResult`).

---

## Architecture

```
OverVault API
        |
        v
RealChainService
        |
        v
Web3.py
        |
        v
MST EVM Network
        |
        v
Smart Contracts
```

---

## Environment Setup

The following environment variables configure the `RealChainService`:

```dotenv
# ---------- EVM Node & Signing Wallet ----------
EVM_RPC_URL=https://testnetrpc.mstblockchain.com
EVM_PRIVATE_KEY=<your-funded-testnet-private-key>

# ---------- Deployed Contract Addresses ----------
CONTRACT_ADDRESS_AUDIT=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
CONTRACT_ADDRESS_INTEGRITY=0x0165878A594ca255338adfa4d48449f69242Eb8F
CONTRACT_ADDRESS_OWNERSHIP=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
CONTRACT_ADDRESS_PERMISSION=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
```

*(Note: `MST_RPC_URL` and `MST_PRIVATE_KEY` are also natively supported as fallback aliases).*

---

## Validation

### Backend Test Suite
```bash
cd backend
pytest -rs
```
**Result**: `117 passed`

### MST Connection & RealChain Validation
```bash
pytest -m mst_connection -rs
pytest -m mst_real_chain -rs
```
**Results**:
- **Chain ID Verified**: Node reports valid network chain ID.
- **RPC Reachable**: JSON-RPC connectivity confirmed.
- **Contract Calls Successful**: `log_audit()`, `commit_hash()`, and `register_ownership()` verified on-chain.

---

## Next Phase

Future phases can expand upon this foundation with:
- **Event Indexing**: Real-time listening and indexing of contract event logs for high-throughput queries.
- **Richer Transaction Metadata**: Gas tracking, block timestamp proofs, and detailed receipt analytics.
- **Production Monitoring**: Health check alerts for node latency, gas balance thresholds, and RPC timeouts.
- **Deployment Automation**: CI/CD scripts for automated contract migration and contract address synchronization.
