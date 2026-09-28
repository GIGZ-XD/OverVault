# ADR 0007: Integrating Pannaga's wallet_auth - fixes and reconciliation

Status: accepted  ·  Owner: Vineeth (integrating Pannaga's nonce.py/verify.py, delivered working)

## What was delivered
`app/auth/wallet_auth/{__init__,nonce,verify}.py`, `api/routes/auth.py`,
`app/schemas/auth.py`, `app/auth/dev_auth.py` (all correct, unlike Sriganesh's
batch - no bugs found in her actual logic). Also `specs/wallet_auth.md`,
`specs/signing_payloads.json`, `specs/openapi.yaml` (the real frozen specs).

## Placed as delivered, unchanged
`wallet_auth/nonce.py`, `wallet_auth/verify.py`, `wallet_auth/__init__.py` - all
placed verbatim. Her `verify_wallet_login()` already has an injectable
`user_lookup` parameter specifically for "Vineeth owns the actual
implementation" (her comment), so no edits to her files were needed at all -
just plugged into the seam she built.

## New file: app/auth/user_lookup.py
Implements the injected `user_lookup` callable as a real query against
`User.wallet_address`. Per wallet_auth.md section 9 ("Admins add users and
pre-register wallet addresses... unregistered returns 403"), this does NOT
create a user on a miss - a miss returns None, which is exactly what makes
her `verify_wallet_login()` raise `AddressNotFoundError`.

## Corrected assumptions from ADR 0005 / earlier
1. `WalletVerifyRequest` had a `nonce` field - wrong. Her `WalletLoginRequest`
   is `{address, signature}` only; the nonce is looked up server-side by
   address. Fixed in `schemas/auth.py` and in the frontend's
   `types.ts::WalletVerifyBody`.
2. `DevLoginRequest` used `email` - wrong. The frozen spec uses `user_id`.
   Fixed; `dev_login()` now looks up by id.
3. Wallet auto-provisioning (`wallet_auto_provision` setting, auto-creating a
   User on first wallet login) directly contradicted wallet_auth.md section 9.
   **Removed entirely** - the setting, and the auto-create code path.

## Shared fixture identity (u1-u4)
Her `verify.py`'s placeholder `_default_user_lookup` and `dev_auth.py`'s
`_DEV_USERS` both hardcoded the same four ids/wallets, which also match
Pavan's `users.json` fixture (Asha Rao/u1/0xaaa1, Ravi Kumar/u2/0xbbb2, Meera
Iyer/u3/0xccc3, Kiran Shah/u4/0xddd4). This is the team's one shared identity
set across mocks, wallet auth, and dev auth. `dev_auth.py`'s `SEED_USERS` now
seeds exactly these four ids, so dev-login and wallet-login resolve to the
SAME accounts. A fifth user, `u5` (no wallet), is Vineeth's own addition -
needed to test permission grants between two peer employees - and is NOT
part of the shared team fixture.

## New dependency
`eth-account>=0.11` - her `verify.py` needs it for EIP-191 signature recovery.
Added to `requirements.txt`.

## Not reconciled - flagged, not silently fixed
* **Error response shape.** Her two routes return
  `{"detail": {"code": ..., "message": ...}}` (nested), matching
  wallet_auth.md's per-condition code table exactly. Every other route in the
  app returns `{"detail": "...", "code": "..."}` (flat, via the `DomainError`
  handler in `main.py`). Kept her shape for these two endpoints since it's her
  delivered, spec-matching design - but the app now has two different error
  shapes depending on which endpoint you hit. Worth the team picking one
  convention.
* **`GET /audit` vs `GET /audit/{file_id}`.** `openapi.yaml` (the frozen spec)
  defines a flat, filterable `GET /audit`. Sriganesh's delivered route (ADR
  0006) is `GET /audit/{file_id}`. Not touched here - raise with him.
* **Permission vocabulary mismatch.** `signing_payloads.json`'s
  `permission_grant` template lists `["read", "write", "append", "admin"]`;
  the backend's `PermissionLevel` enum is `{read, write, manage}`. Unresolved -
  needs Pannaga, Sriganesh and Vineeth to agree on one set before the signing
  modal and the grant endpoint can actually match.

## Verified
Real EIP-191 signatures (via `eth_account.Account`), not mocks:
* A genuine signed nonce message resolves to a JWT for the linked user.
* An unregistered address is rejected (403 `address_not_found`) - confirms no
  auto-provisioning.
* A signature from the wrong private key is rejected (401 `invalid_signature`).
* A nonce is single-use - replaying the same signature fails
  (401 `nonce_expired`).

All 44 backend tests pass (40 from before + 4 new wallet-auth integration
tests using real cryptographic signatures).

## Still needed for Phase 3
Her frontend pieces (`lib/wallet/*`, `signing-modal.tsx`) and `e2e/` - not
backend, can't be integrated the way this file's siblings were.
