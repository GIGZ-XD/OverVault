# ADR 0005: Backend conforms to Pavan's frontend mock contract

Status: accepted  ·  Owner: Vineeth (resolved with Pavan's handlers.ts as the source of truth)

## Context
Pavan's MSW mocks (`frontend/src/mocks/handlers.ts`) were built against a flatter, chain-inclusive
shape of the API than the backend core had. Comparing them surfaced real drift: different paths,
HTTP methods, field names and response shapes across auth, files, permissions and approvals. Per the
work distribution doc, any such change must land as one update covering both sides.

## Decision
The backend now matches the mock's contract, at the direction of the team:

| Area | Change |
|---|---|
| Wallet auth | `POST /auth/nonce` (was `/auth/wallet/nonce`); `POST /auth/wallet-login` (was `/auth/wallet/verify`) |
| Dashboard | `DashboardSummary` fields renamed/replaced: `verified_files`, `active_permissions`, `integrity_score`, `blockchain_status` |
| File object | `FileOut` gained `owner`, `size`, `protection`, `verification`, `hash`, `ownership_tx` (mock's names); old field names kept alongside as additive extras |
| Protection | `PUT /files/{id}/protection` (was `PATCH`), body field `protection` (was `protection_mode`) |
| Verify | New `POST /files/{id}/verify` endpoint, matching the mock |
| Permissions | Request fields `grantee`/`permission` (was `user_id`/`level`); response has a computed `status` (`active`/`revoked`/`expired`); revoke is `DELETE /permissions/{id}` (was `POST .../revoke`) |
| Approvals | Submit is flat `POST /approvals` with `file_id` in the body (was nested under `/files/{file_id}/approvals`); a single `POST /approvals/{id}/decision` with `{decision: "approved"|"rejected"}` replaces separate `/approve` and `/reject` |

## Two things NOT conformed, and why
Real encrypted storage needs actual file bytes; the mock's JSON-only bodies can't carry them.
* **Upload / new version** stay `multipart/form-data` (`upload` file + `comment`), not JSON.
* **Download** returns raw file bytes with `X-Content-SHA256`/`X-File-Version` headers, not the
  mock's `{content, hash, verified}` JSON.

Pavan's real integration in Phase 3 needs to send FormData for uploads and fetch-as-blob (reading
the headers) for downloads. Both are flagged inline in `api/routes/files.py`.

## Also not resolved here
`verification`/`verified_files`/`ownership_tx` are placeholders (self-consistency only: the stored
hash is recomputed and compared on every read, but nothing is checked against the chain yet).
`chain_hash` in `/verify` mirrors `local_hash`. These become real once Sriganesh's audit/ChainService
layer lands - at that point `services/audit.py`'s real implementation and a chain lookup replace the
placeholders in `file_out()`, `verify_file()` and `dashboard_summary()`.

## Consequences
Pavan's existing mocks and fixtures should now match without him changing them. `specs/openapi.yaml`
needs to be regenerated/diffed (`make openapi`) and treated as updated in this same change, per the
"frozen contract" rule. All 36 backend tests pass against the new contract.
