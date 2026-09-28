# Permission contract spec

Records grants and revocations: file_id, grantee, action, expiry. Events: PermissionGranted, PermissionRevoked.

Never store file contents, only hashes and references.
