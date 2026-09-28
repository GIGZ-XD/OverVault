# Security Review Checklist — OverVault v1.0

**Reviewer:** Vineeth / Pavan  
**Date:** 2026-09-29  
**Scope:** Backend API, Frontend UI, Docker, CI

---

## 1. Encryption & Hashing
- [x] Files encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256) — `backend/app/services/encryption.py`
- [x] Master key derived via SHA-256 from env var `MASTER_KEY`, never hardcoded
- [x] SHA-256 hash computed on every upload and stored alongside file — `backend/app/services/hashing.py`
- [x] Hash verification uses `hmac.compare_digest()` for timing-safe comparison
- [x] Decryption failure raises `IntegrityViolation` (500) to flag tampered data

## 2. RBAC & Least Privilege
- [x] Four roles enforced: `employee`, `manager`, `auditor`, `admin` — `backend/app/services/rbac.py`
- [x] Capabilities per role explicitly enumerated (whitelist, not blacklist)
- [x] `require_capability()` gate on every protected API route
- [x] File-level permission grants with expiration — `backend/app/services/permissions.py`
- [x] Expired grants automatically cleaned by `expiry_job` background worker

## 3. Authentication
- [x] JWT-based auth with configurable `JWT_SECRET` and `JWT_ALGORITHM`
- [x] Dev mode uses seeded test users (never in production)
- [x] Wallet auth mode rejects unregistered addresses with 403 (`address_not_found`)
- [x] No auto-provisioning of wallet addresses (per ADR 0007)
- [x] Nonce-based challenge-response for wallet authentication

## 4. Secrets Management
- [x] `.env.example` contains placeholder values only — no real secrets committed
- [x] `.gitignore` excludes `.env`, `*.db`, storage directories
- [x] No private keys, API keys, or passwords found in source code (verified via grep scan)
- [x] `MASTER_KEY` and `JWT_SECRET` both carry "change-me" defaults with documentation

## 5. On-Chain Security
- [x] Only SHA-256 hashes and metadata references are stored on-chain — never file content
- [x] Chain mode configurable: `fake` (dev), `demo`, `real` — backend never calls chain in tests
- [x] Outbox pattern ensures chain writes are idempotent and retryable
- [x] MSTScan links are for verification only; no private data exposed

## 6. API Security
- [x] CORS restricted to `http://localhost:3000` by default
- [x] `expose_headers` limited to `X-Content-SHA256`, `X-File-Version`, `Content-Disposition`
- [x] File upload size capped at 25 MB (`MAX_UPLOAD_MB`)
- [x] Domain errors mapped to proper HTTP status codes (400, 403, 404, 409, 422, 500)

## 7. Frontend Security
- [x] API client does not store tokens in localStorage (session-based)
- [x] No raw user input rendered as HTML (React auto-escapes)
- [x] Mock mode (MSW) isolated from production code paths
- [x] No secrets or keys embedded in frontend bundle

## 8. Infrastructure
- [x] Docker images use slim/alpine base images
- [x] Backend Dockerfile sets `PYTHONDONTWRITEBYTECODE=1` and `PYTHONUNBUFFERED=1`
- [x] Docker Compose includes health checks for backend service
- [x] Alembic migrations run before app start in production container
- [x] `AUTO_CREATE_TABLES=false` in Docker (uses Alembic instead)

## 9. CI Pipeline
- [x] Backend CI: pytest, migration round-trip, `alembic check`, Docker build
- [x] Frontend CI: lint, typecheck, test, build
- [x] E2E CI: Playwright tests with `workflow_dispatch` trigger
- [x] `CHAIN_MODE=fake` in CI to avoid testnet dependency

---

**Overall Assessment:** ✅ All items pass. Ready for demo deployment.
