# ADR 0003: audit.record() contract between services and the audit layer

Status: proposed (must be agreed with Sriganesh in Phase 0)  ·  Owner: Vineeth + Sriganesh

## Decision
Services call, after every state-changing action:

    audit.record(db, *, actor_id, action, resource_type, resource_id,
                 content_hash=None, metadata=None)

* It only ADDS the `audit_outbox` row to the caller's session. It never commits; the service commits
  once, so the action and its outbox row are atomic.
* Services never call the chain. The outbox worker drains rows in batches through `ChainService`.
* Actions emitted today: `file.created`, `version.created`, `version.rollback`, `file.deleted`,
  `file.protection_changed`, `permission.granted`, `permission.revoked`, `permission.expired`,
  `approval.submitted`, `approval.approved`, `approval.rejected`.
* Wallet signatures on grant/revoke/approve/reject are passed through in `metadata["signature"]`.

## Consequences
`services/audit.py` in the backend is a placeholder until Sriganesh's implementation replaces it.
Changing the signature is a frozen-contract change (single PR, both owners).
