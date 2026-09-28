# Wallet auth flow (owner: Pannaga)

1. Client calls `POST /auth/nonce { address }` and receives `{ nonce, message }`.
2. Wallet signs `message` (BridgeKey).
3. Client calls `POST /auth/wallet-login { address, signature }`.
4. Backend verifies signature and nonce (single use, short expiry), links address to user, returns JWT.

Notes: nonce expires in 5 minutes; address stored lowercase; unknown address returns 403 unless invited.
