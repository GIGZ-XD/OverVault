# Integrity contract spec

Stores hash commitments per (file_id, version). Function to verify a hash. Event: HashCommitted.

Never store file contents, only hashes and references.
