/**
 * MSW mock handlers (Pannaga owns auth handlers; Pavan/Vineeth own the rest).
 *
 * Auth handlers mirror the real backend behaviour so the login flow works
 * in NEXT_PUBLIC_API_MODE=mock without a running backend.
 *
 * Security note: signatures are NOT cryptographically verified here —
 * that is the backend's job.  The mock simply accepts the mock adapter's
 * fixed signature to unblock frontend development.
 */
import { http, HttpResponse } from "msw";
import files from "../../../specs/fixtures/files.json";
import users from "../../../specs/fixtures/users.json";

// ---------------------------------------------------------------------------
// In-memory nonce store for mock (keyed by address)
// ---------------------------------------------------------------------------

const _nonceStore: Map<string, string> = new Map();

function mockNonce(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

// Mock signature — must match mock-adapter.ts MOCK_SIGNATURE constant
const MOCK_SIGNATURE = "0xmocksig_pannaga_overvault_test";

// Mock users indexed by address (from fixtures)
const usersByAddress: Record<string, (typeof users)[0]> = {};
for (const u of users) {
  usersByAddress[u.wallet.toLowerCase()] = u;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // ── Auth: nonce ──────────────────────────────────────────────────────────
  http.post("*/auth/nonce", async ({ request }) => {
    const body = (await request.json()) as { address?: string };
    const address = (body.address ?? "").toLowerCase();

    if (!address) {
      return HttpResponse.json({ detail: "address required" }, { status: 422 });
    }

    const nonce = mockNonce();
    _nonceStore.set(address, nonce);

    return HttpResponse.json({
      nonce,
      message: `Sign in to OverVault.\n\nNonce: ${nonce}`,
    });
  }),

  // ── Auth: wallet-login ────────────────────────────────────────────────────
  http.post("*/auth/wallet-login", async ({ request }) => {
    const body = (await request.json()) as {
      address?: string;
      signature?: string;
    };
    const address = (body.address ?? "").toLowerCase();
    const signature = body.signature ?? "";

    // Must have a valid nonce in store
    const nonce = _nonceStore.get(address);
    if (!nonce) {
      return HttpResponse.json(
        { detail: { code: "nonce_expired", message: "No valid nonce" } },
        { status: 401 }
      );
    }

    // In mock mode: accept only the mock adapter's signature
    if (signature !== MOCK_SIGNATURE) {
      _nonceStore.delete(address); // consume on failure too
      return HttpResponse.json(
        { detail: { code: "invalid_signature", message: "Signature mismatch" } },
        { status: 401 }
      );
    }

    // Consume nonce (single-use)
    _nonceStore.delete(address);

    // Look up user
    const user = usersByAddress[address];
    if (!user) {
      return HttpResponse.json(
        { detail: { code: "address_not_found", message: "Address not registered" } },
        { status: 403 }
      );
    }

    // Return placeholder token (Vineeth replaces with real JWT)
    return HttpResponse.json({
      access_token: `mock.jwt.${user.id}.${Date.now()}`,
      token_type: "bearer",
    });
  }),

  // ── Files ─────────────────────────────────────────────────────────────────
  http.get("*/files", () => HttpResponse.json(files)),
];
