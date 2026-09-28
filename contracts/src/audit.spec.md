# Audit contract spec

Append-only event log: event_type, ref, actor, timestamp. Event: AuditLogged.

Never store file contents, only hashes and references.
