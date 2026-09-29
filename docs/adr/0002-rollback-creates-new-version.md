# ADR 0002: Rollback creates a new version

Status: accepted  ·  Owner: Vineeth

## Decision
Rolling back to version N copies its content into a NEW version (`rolled_back_from = N`). History is
never deleted or rewritten. Protection modes: `append_only` allows new versions but not rollback or
delete; `read_only` allows nothing. Loosening a lock is admin-only. Deletes are soft.

## Consequences
The audit trail and on-chain hash history stay linear and complete. Storage grows with every
rollback. A rolled-back file needs a fresh approval.
