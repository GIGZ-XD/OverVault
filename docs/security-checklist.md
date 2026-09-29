# OverVault Security Review Checklist

## Status: Validated for Hackathon MVP

### 1. Authentication & Wallet Verification
- [x] **EIP-191 personal_sign**: Backend validates cryptographic signatures via `eth_account.Account.recover_message` + `encode_defunct`.
- [x] **Nonce Security**:
  - Generated cryptographically via `secrets.token_hex(32)`.
  - Stored with 300-second TTL in thread-safe memory store.
  - Consumed on verification (single-use, prevents replay attacks).
  - Replayed nonce rejected with `NonceExpiredError`.
- [x] **Address Normalization**: All Ethereum addresses are lowercased before lookup and signature recovery to ensure case-insensitivity.
- [x] **Unregistered Address Guard**: Nonce can be issued for any address, but login requires address present in User table (returns 403 `address_not_found`).

### 2. Token & Session Handling
- [x] **JWT Generation**: Signed using `HS256` with configurable `jwt_secret` and expiration.
- [x] **Unified Token Storage**: Frontend consistently uses `localStorage["overvault.token"]` via `token.ts` for both login session state and API Authorization headers.
- [x] **Authorization Header**: Bearer token sent with all protected API requests via `client.ts:authHeaders()`.
- [x] **Session Invalidation**: `clearSession()` / `clearToken()` completely purges credentials from browser storage.

### 3. Authorization & RBAC
- [x] **Role Hierarchy**: 4 roles: `employee`, `manager`, `admin`, `auditor`.
- [x] **Capability Enforcement**: Explicit checks via `rbac.require_capability()`:
  - `file.create`: employee, manager, admin
  - `approval.decide`: manager, admin
  - `file.delete`: admin only
  - `audit.read`: auditor, admin, manager
- [x] **File-Level Access Control**: Permission levels (`read`, `write`, `admin`) enforced per file via `permissions.require_access()`.

### 4. File Storage & Encryption
- [x] **Private Storage**: Raw file content stored in private local storage (`storage_dir`), NEVER committed to blockchain.
- [x] **Integrity Hashing**: SHA-256 computed on upload; verified on every download and version read.
- [x] **Content-Addressed Keys**: Storage keys use `<file_id>/v<version>` pattern, preventing path traversal attacks.
- [x] **Upload Limits**: Enforces `max_upload_mb` limit (HTTP 413 on exceed) and non-empty check (HTTP 422).

### 5. Blockchain Boundary & Data Privacy
- [x] **Zero File Content on Chain**: Only SHA-256 hashes, file IDs, version numbers, and actor addresses cross the blockchain boundary.
- [x] **Async Chain Writes via Outbox**: Mutations write to local `AuditOutbox` within the database transaction; the background worker handles chain submissions asynchronously.
- [x] **Fake Chain for CI/Dev**: `FakeChainService` used in development and tests — no real private keys or gas needed.
- [x] **MST Testnet Boundary**: Production transactions submitted to MST EVM (Chain ID: 91562037 / `0x5752035`).

### 6. Secrets & Configuration
- [x] `.env.example` provided with safe defaults.
- [x] No private keys or secrets committed to repository.
- [x] CI runs entirely on mock wallet + fake chain without external dependencies.
