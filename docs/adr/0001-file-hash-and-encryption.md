# ADR 0001: Hash the plaintext, encrypt at rest, verify on every read

Status: accepted  ·  Owner: Vineeth

## Context
OverVault must prove file integrity and keep confidential files private. Only hashes and
references may cross to the chain.

## Decision
* Each version stores the SHA-256 of the **plaintext** (`file_versions.sha256`); this is the value
  committed on-chain.
* File bytes are encrypted with Fernet (authenticated encryption) before being written to
  `storage_dir`, keyed from `MASTER_KEY`.
* Every read decrypts, recomputes the SHA-256 and compares in constant time; a mismatch raises
  `IntegrityViolation` (HTTP 500, code `integrity_violation`). Writes are atomic (temp file + rename).

## Consequences
Tampering with the ciphertext, the key or the recorded hash is detected on read. Files are handled
in memory, so uploads are capped by `MAX_UPLOAD_MB` (default 25). Rotating `MASTER_KEY` needs a
re-encryption job (not built).
