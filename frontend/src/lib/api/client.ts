/**
 * Thin fetch wrapper for the OverVault backend. Every hook in ./hooks goes
 * through this file, so the base URL, auth header and error shape are handled
 * in exactly one place.
 *
 * Toggle real API vs mocks with NEXT_PUBLIC_API_MODE in config.ts - MSW
 * intercepts these same fetch calls when apiMode === "mock" (see
 * mocks/browser.ts), so nothing here needs to know which mode is active.
 */
import { config } from "@/lib/config";
import { getToken } from "./token";

const API_BASE = `${config.apiUrl}/api`;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseError(res: Response): Promise<never> {
  let detail = res.statusText || `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (body?.detail && typeof body.detail === "object") {
      // Wallet-auth error shape: { detail: { code: "...", message: "..." } }
      if (typeof body.detail.message === "string") detail = body.detail.message;
      if (typeof body.detail.code === "string") code = body.detail.code;
    }
    if (typeof body?.code === "string") code = body.code;
  } catch {
    // response wasn't JSON (e.g. a network-level error page) - keep the fallback
  }
  throw new ApiError(res.status, detail, code);
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) return parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`, { headers: authHeaders() }).then(asJson<T>);
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(asJson<T>);
}

function putJson<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).then(asJson<T>);
}

function del<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`, { method: "DELETE", headers: authHeaders() }).then(asJson<T>);
}

/**
 * Real uploads need actual file bytes, which JSON can't carry - so this stays
 * multipart/form-data even though the rest of the contract is JSON (see
 * ADR 0005). Don't set Content-Type yourself; the browser sets the multipart
 * boundary when you pass a FormData body.
 */
function postForm<T>(path: string, form: FormData): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  }).then(asJson<T>);
}

/**
 * File downloads return raw bytes with the hash/version as headers (not the
 * mock's JSON body) - see ADR 0005. Read local.sha256 to show/compare the hash,
 * and turn local.blob into an object URL (or File) to save or preview it.
 */
async function getBlob(
  path: string
): Promise<{ blob: Blob; sha256: string | null; version: number | null }> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) return parseError(res);
  return {
    blob: await res.blob(),
    sha256: res.headers.get("X-Content-SHA256"),
    version: res.headers.get("X-File-Version") ? Number(res.headers.get("X-File-Version")) : null,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  if (method === "GET") return getJson<T>(path);
  if (method === "POST") return postJson<T>(path, init?.body ? JSON.parse(String(init.body)) : undefined);
  if (method === "PUT") return putJson<T>(path, init?.body ? JSON.parse(String(init.body)) : {});
  if (method === "DELETE") return del<T>(path);
  return fetch(`${API_BASE}${path}`, init).then(asJson<T>);
}

export const api = Object.assign(request, {
  get: getJson,
  post: postJson,
  put: putJson,
  delete: del,
  postForm,
  getBlob,
});
