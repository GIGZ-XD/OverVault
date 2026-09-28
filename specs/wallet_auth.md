# Wallet Authentication Specification

**Owner:** Pannaga  
**Status:** Frozen — coordinate before changing  
**Version:** 1.0.0

---

## 1. Overview

OverVault uses BridgeKey Wallet for user authentication on MST Testnet.
The wallet identity (address) is linked to the user account in the database.
A short-lived cryptographic nonce prevents replay attacks.

```
BridgeKey Wallet
      ↓
Frontend Wallet Adapter (lib/wallet)
      ↓
POST /auth/nonce  →  { nonce, message }
      ↓
wallet.signMessage(message)  →  signature
      ↓
POST /auth/wallet-login  →  { access_token, token_type }
      ↓
JWT session (Vineeth's auth layer)
      ↓
Authenticated application
```

---

## 2. API Endpoints

### 2.1 Request Nonce

```
POST /auth/nonce
```

**Request body:**

```json
{ "address": "0x..." }
```

**Response 200:**

```json
{
  "nonce": "4f9a2b...",
  "message": "Sign in to OverVault.\n\nNonce: 4f9a2b..."
}
```

**Behavior:**
- `address` is normalized to lowercase before storage and lookup.
- A random 32-byte hex nonce is generated and stored with the address.
- Nonce expires in **5 minutes**.
- If a valid unexpired nonce already exists for the address, it is replaced.
- The `message` is the exact string the frontend must pass to `wallet.signMessage()`.

### 2.2 Wallet Login

```
POST /auth/wallet-login
```

**Request body:**

```json
{
  "address": "0x...",
  "signature": "0x..."
}
```

**Response 200:**

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer"
}
```

**Behavior:**
- `address` is normalized to lowercase.
- The stored nonce for `address` is fetched and the expiry is checked.
- The recovered signer address from the signature must match `address`.
- Nonce is consumed (deleted/invalidated) after a successful or failed attempt to prevent replay.
- On success: the user record linked to `address` is returned; Vineeth's JWT layer issues the token.
- On failure: appropriate error code (see section 5).

---

## 3. Message Format

The signing message must be a **human-readable string** so that BridgeKey displays meaningful text to the user.

```
Sign in to OverVault.

Nonce: {nonce}
```

The backend reconstructs this message from the stored nonce to verify the signature.

---

## 4. Nonce Rules

| Property       | Value                                |
|----------------|--------------------------------------|
| Format         | 32-byte random hex string            |
| Storage        | In-memory dict (dev) / DB table (prod) |
| Expiry         | 300 seconds (5 minutes)              |
| Single-use     | Yes — consumed on first verification attempt |
| Association    | Keyed by lowercase wallet address    |

---

## 5. Error Cases

| Condition                              | HTTP Status | Detail                        |
|----------------------------------------|-------------|-------------------------------|
| Address not invited / unknown          | 403         | `address_not_found`           |
| Nonce missing or expired               | 401         | `nonce_expired`               |
| Signature does not match address       | 401         | `invalid_signature`           |
| Nonce replay (already consumed)        | 401         | `nonce_already_used`          |
| Malformed address                      | 422         | validation error              |
| Malformed signature                    | 422         | validation error              |

---

## 6. Wrong-Network Behavior

The wallet adapter (`lib/wallet`) must detect the active network.

| Condition                | Behavior                                      |
|--------------------------|-----------------------------------------------|
| Connected to MST Testnet | Proceed normally                              |
| Connected to wrong network | Surface a UI error before requesting the nonce |
| Network switch mid-flow  | Detect and abort; show reconnect prompt       |

Network check is performed by the frontend adapter before calling `POST /auth/nonce`.
The backend does not enforce network directly — it verifies the signature and address only.

---

## 7. Signature Rejection Behavior

When the user declines the signing request in BridgeKey:

- The wallet adapter throws/rejects with a distinguishable error (e.g., `UserRejectedRequestError`).
- The frontend catches this and shows: *"Signature declined. Try again."*
- No nonce request is wasted (the nonce remains valid until expiry).
- The user can retry without requesting a new nonce if still within the 5-minute window.

---

## 8. Wallet Disconnect Behavior

If the wallet disconnects mid-flow:

- The adapter emits a disconnect event.
- Any in-progress sign request is cancelled.
- The login page resets to its initial state.
- The user may reconnect and start the flow again.

---

## 9. Address-to-User Linking

```
wallet_address (lowercase)  →  User record (id, role, name)
```

- The link is stored in the `users` table via a `wallet_address` column.
- One address maps to exactly one user.
- The same user cannot have multiple addresses in v1.
- Admins add users and pre-register their wallet addresses.
- Attempting login from an unregistered address returns 403.

---

## 10. Verified Identity Format (Pannaga → Vineeth handoff)

After successful signature verification, `verify.py` returns:

```python
@dataclass
class WalletIdentity:
    address: str          # lowercase, verified
    user_id: str          # from user record
    role: str             # employee | manager | admin | auditor
```

Vineeth's JWT layer accepts a `WalletIdentity` and issues a JWT containing
`sub` (user_id), `wallet` (address), `role`.

---

## 11. Dev Mode

When `AUTH_MODE=dev`, the wallet login flow is bypassed.
Use `POST /auth/dev-login { user_id }` to get a token directly.
Mock wallet (`NEXT_PUBLIC_WALLET_MODE=mock`) always returns address `0xaaa1`
and signature `0xmocksignature`.

The dev/mock path must never be reachable when `AUTH_MODE=wallet`.
