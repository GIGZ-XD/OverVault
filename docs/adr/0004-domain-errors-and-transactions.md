# ADR 0004: Domain errors in rbac.py; services own the transaction

Status: accepted  ·  Owner: Vineeth

## Decision
Services raise domain exceptions (`NotFound` 404, `Forbidden` 403, `Conflict` 409, `Invalid` 422,
`IntegrityViolation` 500) defined in `services/rbac.py` so the frozen folder structure gains no new
file. `main.py` converts them to `{"detail", "code"}` JSON. Each service action commits exactly once,
after `audit.record(...)`.

## Consequences
Routes stay free of business logic and HTTP-status decisions. If the exceptions later deserve their
own module, moving them is a mechanical refactor.
