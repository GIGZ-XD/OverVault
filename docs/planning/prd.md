# OverVault — Product Requirements Document (PRD)

## 1. Overview
OverVault is a blockchain-audited enterprise storage and document management platform. It combines private, encrypted storage infrastructure with **MST Blockchain** verification, **MST Testnet** smart contract deployment, and **BridgeKey Wallet** integration for identity and transaction signing.

The goal is to provide secure document storage, ownership verification, permission management, integrity checking, and transparent auditing — without ever storing confidential files directly on-chain.

## 2. Problem Statement
Organizations currently manage sensitive documents on centralized storage systems. These systems suffer from:
- Unauthorized or undetected modification
- Difficult, opaque auditing
- Unclear or disputed ownership
- Inefficient, manual permission management

OverVault solves this by keeping files in private storage while using MST Blockchain as an independent verification and governance layer.

## 3. Goals & Objectives
- Provide secure enterprise document storage
- Enable blockchain-based ownership verification
- Provide role-based access control (RBAC)
- Maintain file integrity using cryptographic hashes
- Enable tamper-resistant audit trails using MST Blockchain records
- Integrate BridgeKey Wallet for blockchain identity and transaction signing
- Validate all smart contracts via MST Testnet deployment before production

## 4. Target Users
| User | Needs |
|---|---|
| Enterprise employees | Personal/workspace storage, version history |
| Managers / Approvers | Review and approve document changes |
| Compliance / Audit teams | Tamper-proof audit trail, ownership proof |
| System administrators | Access control, revocation, policy management |

## 5. Core Features
1. **Employee Storage Management** — individual workspaces, quotas, file controls
2. **Access Control** — temporary permissions, expiry dates, revocation
3. **Protected Files** — read-only and append-only protection modes
4. **Version Control** — full history, authorship, timestamps, rollbacks
5. **Approval Workflow** — submit → review → approve/reject changes
6. **Audit Trail** — every file, permission, and admin action logged and anchored on-chain
7. **Blockchain Identity** — BridgeKey Wallet login and transaction signing
8. **Smart Contract Verification** — ownership, permissions, and hashes committed to MST Blockchain, verifiable on MSTScan

## 6. Non-Functional Requirements
- **Security**: encryption at rest and in transit, least-privilege access, secure wallet-based signing
- **Integrity**: cryptographic hash verification for every stored file version
- **Auditability**: every state-changing action produces an on-chain proof
- **Performance**: blockchain writes are asynchronous/batched so they never block core storage operations
- **Portability**: private files never touch the chain — only hashes/references do

## 7. Out of Scope (v1)
- Storing raw file contents on-chain
- Mobile-native clients (BridgeKey's Android app may be evaluated later)
- Multi-chain support (see Future Enhancements)

## 8. Applications / Use Cases
- **Banking** — contracts, financial records, compliance documents
- **Healthcare** — controlled medical records and research documents
- **Government** — verification of official documents/records
- **Legal** — contract and evidence protection
- **Enterprise** — internal documents and IP management

## 9. Success Metrics
- 100% of ownership/permission changes have a corresponding on-chain audit record
- Sub-second private storage read/write latency (blockchain writes excluded)
- Zero undetected unauthorized file modifications in testing (hash mismatch rate = 0)
- Successful end-to-end testnet deployment and wallet-signed transaction flow before mainnet consideration

## 10. Future Enhancements
- AI-based document classification
- Zero-knowledge verification proofs
- Mobile wallet support
- Automated compliance systems
- Multi-chain integration

## 11. Mandatory Technology Constraints
Per project requirements, the following are **mandatory** regardless of downstream technical choices:
- **MST Blockchain** — verification/governance layer
- **MST Testnet Deployment** — for all smart-contract development and testing prior to production
- **BridgeKey Wallet Integration** — for user blockchain identity and transaction signing
