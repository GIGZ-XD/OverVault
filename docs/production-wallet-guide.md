# Production Wallet and Transaction Security Guide

## Overview
This document defines operational guidelines, security best practices, and architecture rules for managing blockchain wallets, signing transactions, and handling credentials in OverVault.

---

## 1. Principles of Wallet Security

1. **Zero Secret Hardcoding:** No private keys, mnemonics, or sensitive credentials may appear in source code, configuration files, or version control.
2. **Environment Variable Isolation:** Keys are injected strictly at runtime via environment variables (`MST_PRIVATE_KEY` / `EVM_PRIVATE_KEY`).
3. **Isolated Signing:** All transactions are signed locally in-memory using Web3.py account management (`Account.from_key`) and submitted via raw transactions (`eth_sendRawTransaction`). No RPC node holds backend keys.
4. **Log Sanitization:** Sensitive key data is always masked (`0x1234...cdef`) when logged or printed in diagnostic output.

---

## 2. Wallet Roles & Key Segregation

OverVault utilizes role-segregated accounts to minimize exposure:

| Role | Address Scope | Purpose | Security Tier |
| :--- | :--- | :--- | :--- |
| **Deployer / Admin** | Cold / Hardware Wallet | Smart contract deployment and initial ownership setup | High (Multi-sig / Hardware) |
| **Relayer / Worker** | Hot Wallet (Container Env) | Automated outbox worker signing of audit logs and hashes | Medium (Vault-injected) |
| **User Signer** | End-User Client Wallet | Optional client-side cryptographic signatures | Decentralized |

---

## 3. Secret Management in Production

### 3.1 Vault & Cloud Key Storage
In enterprise production deployments, inject the private key dynamically into container environments:
- **AWS ECS / EKS:** AWS Secrets Manager with IAM task roles.
- **Kubernetes:** Sealed Secrets / HashiCorp Vault Agent.
- **Docker Compose / Standalone:** `.env.production` with `600` file permissions readable only by the service user.

### 3.2 Secret Masking Utility
The backend includes a dedicated masking utility:
```python
from app.chain.config import mask_secret

logger.info("Using relayer wallet: %s", mask_secret(private_key))
# Output: Using relayer wallet: 0x90f7...b906
```

---

## 4. Key Rotation & Emergency Recovery

### 4.1 Planned Key Rotation
1. Deploy a funded replacement wallet address.
2. If contract ownership or admin roles are assigned to the old key, call `transferOwnership(new_address)`.
3. Update `MST_PRIVATE_KEY` in the secret manager.
4. Trigger a rolling restart of backend worker instances.
5. Verify worker continues processing outbox events using the new address.

### 4.2 Emergency Compromise Procedure
If a worker key is suspected to be compromised:
1. **Pause Workers:** Immediately scale outbox worker replicas to 0.
2. **Drain Remaining Gas:** Transfer any native MST balance from the compromised address to a secure cold wallet.
3. **Revoke Permissions:** If the compromised address held contract roles, revoke them from the deployer/admin account.
4. **Deploy Fresh Credentials:** Generate a new keypair, fund it, update environment configuration, and resume workers.
