# Phase 3 Diagnostic Audit: Frontend-to-Backend & Wallet Seams

**Author:** Pavan (Frontend Engineer)  
**Date:** September 29, 2026  
**Context:** Cross-verification of "Phase 3 - Integration on the Fake Chain" between Next.js App Shell, Vineeth's FastAPI Backend, Pannaga's BridgeKey Wallet Auth, and Ganesh's Blockchain Layer.

---

## Executive Summary

The Next.js frontend feels like a "static website" due to **5 distinct integration breakdowns across architectural seams**:
1. **Stale MSW Service Worker Caching:** If MSW was enabled previously, `/mockServiceWorker.js` remains active in the browser's Service Worker container and intercepts all `/api/*` fetch calls even when `apiMode === "real"`, because `providers.tsx` never unregisters stale service workers.
2. **Unconditional Dev Login & Missing Route Gate:** `providers.tsx` automatically fires a background dev-login for `u1` (Asha Rao) on app mount, while `app/page.tsx` unconditionally redirects to `/dashboard` without verifying authentication. Furthermore, `topbar.tsx` hardcodes user initials (`AR`) and wallet address (`0xaaa128b94f09c21e`).
3. **Pannaga's Unimplemented BridgeKey Adapter:** `frontend/src/lib/wallet/bridgekey-adapter.ts` contains stubbed methods that unconditionally throw `Error("not implemented")`, while `config.ts` defaults to `mockAdapter`.
4. **OpenAPI Schema Drift on Auth & Uploads:** `useDevLogin()` in `useAuth.ts` sends `{ email }`, but FastAPI's `DevLoginRequest` strictly expects `{ user_id }` (returning HTTP 422). File uploads on the dashboard send JSON instead of `multipart/form-data`.
5. **Chain Layer State (Phase 3 vs Phase 4):** Backend `chain_mode` is `"fake"`. Ganesh's `backend/app/chain/real.py` has not been implemented yet (`raise NotImplementedError` on all methods); real MST testnet connectivity with `mst-sdk-python` is Phase 4, not Phase 3.

---

## 1. MSW Interception Analysis

### Inspected Files
- `frontend/src/lib/config.ts`
- `frontend/.env.local`
- `frontend/src/mocks/browser.ts`
- `frontend/src/mocks/handlers.ts`
- `frontend/src/app/providers.tsx`

### Findings
* **Environment Variable:** `frontend/src/lib/config.ts` line 3:
  ```typescript
  apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "real",
  ```
  If `.env.local` is missing or defines `NEXT_PUBLIC_API_MODE=mock`, MSW handlers in `frontend/src/mocks/handlers.ts` intercept requests.
* **Active Service Worker Leak in Browser:** In `frontend/src/app/providers.tsx` (lines 13–32), MSW is started via `worker.start({ serviceWorker: { url: "/mockServiceWorker.js" } })`. Once registered in Chrome/Edge, **a Service Worker remains permanently active in the browser cache** across page reloads until explicitly unregistered. Switching `apiMode` to `"real"` stops calling `worker.start()`, but **does not unregister** the already-running service worker.
* **Masked Auth Flow:** `providers.tsx` lines 34–50:
  ```typescript
  // Real API mode: Ensure we have a valid dev session token for API requests
  const res = await fetch(`${config.apiUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "u1" }),
  });
  ```
  This overrides the real wallet login state on every single page refresh, making the app appear permanently pre-seeded with Asha Rao.

### Remediation
1. Explicitly purge any registered MSW service workers when `config.apiMode === "real"` inside `providers.tsx`.
2. Remove the forced background login from `providers.tsx` so the app respects the user's actual login state.

---

## 2. API Client Routing & Auth Header Analysis

### Inspected Files
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/config.ts`
- `frontend/src/lib/api/token.ts`

### Findings
* **Base URL Resolution:**
  `frontend/src/lib/api/client.ts` line 13:
  ```typescript
  const API_BASE = `${config.apiUrl}/api`;
  ```
  `config.apiUrl` falls back to `"http://localhost:8000"`. When Vineeth's FastAPI server is running, the client targets `http://localhost:8000/api`.
* **Silent 401 Interception:**
  In `frontend/src/lib/api/client.ts` lines 39–57:
  ```typescript
  if (res.status === 401 && !isRetry && config.apiMode !== "mock") {
    // Silently requests /api/auth/dev-login with user_id: "u1" and retries
  }
  ```
  When an unauthenticated user opens the site, instead of redirecting them to `/login`, `client.ts` silently authenticates them as `u1`! This prevents the login gate from functioning.
* **Token Attachment:**
  Lines 27–33 correctly read from `localStorage.getItem("overvault_token")` and attach `Authorization: Bearer <token>`. FastAPI validates this token with HS256 in `backend/app/deps.py`.

---

## 3. Wallet Adapter State & Address Drift

### Inspected Files
- `frontend/src/lib/wallet/index.ts`
- `frontend/src/lib/wallet/bridgekey-adapter.ts`
- `frontend/src/lib/wallet/mock-adapter.ts`
- `frontend/src/app/(auth)/login/page.tsx`
- `backend/app/auth/dev_auth.py`
- `backend/app/auth/wallet_auth/verify.py`

### Findings
* **Adapter Selection:** `frontend/src/lib/wallet/index.ts` line 5:
  ```typescript
  export const wallet = config.walletMode === "bridgekey" ? bridgekeyAdapter : mockAdapter;
  ```
  `config.ts` defaults to `mockAdapter` unless `NEXT_PUBLIC_WALLET_MODE=bridgekey` is set.
* **Pannaga's BridgeKey Adapter:** In `frontend/src/lib/wallet/bridgekey-adapter.ts` lines 4–10:
  ```typescript
  export const bridgekeyAdapter: WalletAdapter = {
    isInstalled: () => false,
    connect: async () => { throw new Error("not implemented"); },
    disconnect: async () => {},
    signMessage: async () => { throw new Error("not implemented"); },
    sendTransaction: async () => { throw new Error("not implemented"); },
  };
  ```
  It was never implemented. It throws an unhandled exception when invoked.
* **Seeded Wallet Address Discrepancy:**
  - In `backend/app/auth/dev_auth.py` and `app/auth/wallet_auth/verify.py`, the seeded team addresses are:
    - Asha Rao (`u1`): `0xaaa1`
    - Ravi Kumar (`u2`): `0xbbb2`
    - Meera Iyer (`u3`): `0xccc3`
    - Kiran Shah (`u4`): `0xddd4`
  - In `frontend/src/app/(auth)/login/page.tsx` line 34, the frontend had hardcoded: `0xaaa128b94f09c21e`.
  - When the frontend asks `/api/auth/wallet-login` to verify `0xaaa128b94f09c21e`, backend checks `User.wallet_address == address.lower()`. Because `0xaaa128b94f09c21e` is not in the database, backend rejects it with **HTTP 403 `address_not_found`** (ADR 0007).

---

## 4. OpenAPI Schema Drift

### Cross-Referenced Specs
- `specs/openapi.generated.yaml`
- `specs/wallet_auth.md`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/hooks/useAuth.ts`
- `backend/app/schemas/auth.py`

### Identified Mismatches
| Endpoint / Seam | Frontend Expectation | Backend Actual (`specs/openapi.generated.yaml`) | Status |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/dev-login` | `{ email: string }` in `useDevLogin` | `DevLoginRequest: { user_id: string }` | **Drift (Causes 422)** |
| `POST /api/auth/wallet-login` | `{ address, signature }` | `WalletLoginRequest: { address, signature }` | **Aligned** (EIP-191 personal_sign) |
| `POST /api/auth/nonce` | `{ address }` &rarr; `{ nonce, message }` | `NonceRequest` &rarr; `NonceResponse` | **Aligned** |
| `GET /api/auth/me` | Returns `UserOut` | Returns `UserOut { id, email, name, role, wallet_address }` | **Aligned** |
| `POST /api/files` | JSON `{ name, size, protection }` in `dashboard/page.tsx` | `multipart/form-data` with `file: UploadFile` | **Drift (Causes 422)** |
| `Chain Layer` | Live MST Testnet RPC | `FakeChainService` (`chain_mode="fake"`) | **Expected in Phase 3** |

---

## 5. CORS and Auth Headers Verification

### Inspected Files
- `backend/app/main.py`
- `backend/app/config.py`

### Findings
* **CORS Middleware:** `backend/app/main.py` lines 37–44:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=s.cors_origins,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
      expose_headers=["X-Content-SHA256", "X-File-Version", "Content-Disposition"],
  )
  ```
  `s.cors_origins` in `backend/app/config.py` includes `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`.
  **Verdict:** CORS is correctly configured and not blocking requests from Next.js.

---

## 6. Action Plan & Required Code Modifications

To eliminate the static feel and hard-wire the Next.js frontend to the live FastAPI backend and BridgeKey wallet:

### File 1: `frontend/.env.local`
Configure the environment variables to target the live backend and BridgeKey:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_WALLET_MODE=bridgekey
NEXT_PUBLIC_MSTSCAN_BASE_URL=https://mstscan.io
```

### File 2: `frontend/src/app/providers.tsx`
1. Unregister any existing MSW service worker when running in `real` mode to ensure clean network traffic to `localhost:8000`.
2. Remove the forced background login for `u1`.

### File 3: `frontend/src/app/page.tsx` & `frontend/src/app/(app)/layout.tsx`
Enforce an authentication gate: if no token exists in `localStorage`, redirect the user to `/login`.

### File 4: `frontend/src/components/layout/topbar.tsx`
Replace hardcoded `0xaaa128b94f09c21e` and `AR` with dynamic data from `useMe()`.

### File 5: `frontend/src/lib/wallet/bridgekey-adapter.ts`
Implement standard BridgeKey / EIP-1193 provider detection (`window.bridgekey` or `window.ethereum`) with `personal_sign` and fallback to testnet addresses (`0xaaa1`).

### File 6: `frontend/src/lib/api/hooks/useAuth.ts`
Fix `useDevLogin` to send `{ user_id: string }` instead of `{ email }`.
