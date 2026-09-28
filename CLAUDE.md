# CLAUDE.md (instructions for Claude Code, backend track)

## Project
OverVault: FastAPI backend for private encrypted document storage. MST Blockchain is a
verification layer only. **Private files never go on chain, only hashes and references.**

## Stack
Python 3.12, FastAPI, SQLAlchemy + Alembic, Postgres, S3-compatible storage (MinIO in dev),
`hashlib` SHA-256, `cryptography` for file encryption, pytest.

## Layout
- `backend/app/api/routes/`   HTTP routes (thin, no business logic)
- `backend/app/services/`     business logic
- `backend/app/models/`       SQLAlchemy models
- `backend/app/chain/`        ChainService (fake + real). `base.py` must match `specs/chain_service.py`
- `backend/app/workers/`      outbox worker, expiry job
- `backend/tests/`            pytest, mirror the app layout

## Rules
1. Do not edit `specs/` without a note in the PR description and tagging owners.
2. Every state-changing action writes an `audit_outbox` row. Chain writes happen only in the worker.
3. Hash (SHA-256) every file version on upload and verify on read.
4. Default modes: `AUTH_MODE=dev`, `CHAIN_MODE=fake`. Code must work in both modes.
5. Never commit secrets. Use `.env` and testnet-only keys.
6. Write pytest tests alongside every module. Run `make test-backend` before finishing a task.
7. Task format: goal, files to touch, acceptance test. One task per branch.

## Commands
- `make up`, `make backend`, `make test-backend`, `make spec-check`
