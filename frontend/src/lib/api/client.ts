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
import { getToken, setToken } from "./token";

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

async function fetchWithAuth(url: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const headers = authHeaders(init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && !isRetry && config.apiMode !== "mock") {
    try {
      const loginRes = await fetch(`${config.apiUrl}/api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "u1" }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        if (data.access_token) {
          setToken(data.access_token);
          const retryHeaders = authHeaders(init.headers as Record<string, string>);
          return await fetch(url, { ...init, headers: retryHeaders });
        }
      }
    } catch {
      // Ignore login error, fall through to return original 401
    }
  }
  return res;
}

async function parseError(res: Response): Promise<never> {
  let detail = res.statusText || `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
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
  return fetchWithAuth(`${API_BASE}${path}`, { method: "GET" }).then(asJson<T>);
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetchWithAuth(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(asJson<T>);
}

function putJson<T>(path: string, body: unknown): Promise<T> {
  return fetchWithAuth(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(asJson<T>);
}

function del<T>(path: string): Promise<T> {
  return fetchWithAuth(`${API_BASE}${path}`, { method: "DELETE" }).then(asJson<T>);
}

/**
 * Real uploads need actual file bytes, which JSON can't carry - so this stays
 * multipart/form-data even though the rest of the contract is JSON (see
 * ADR 0005). Don't set Content-Type yourself; the browser sets the multipart
 * boundary when you pass a FormData body.
 */
function postForm<T>(path: string, form: FormData): Promise<T> {
  return fetchWithAuth(`${API_BASE}${path}`, {
    method: "POST",
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
  const res = await fetchWithAuth(`${API_BASE}${path}`, { method: "GET" });
  if (!res.ok) return parseError(res);
  return {
    blob: await res.blob(),
    sha256: res.headers.get("X-Content-SHA256"),
    version: res.headers.get("X-File-Version") ? Number(res.headers.get("X-File-Version")) : null,
  };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() || "GET";
  if (method === "GET") return getJson<T>(path);
  if (method === "POST") {
    if (options.body instanceof FormData) return postForm<T>(path, options.body);
    const body = options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : undefined;
    return postJson<T>(path, body);
  }
  if (method === "PUT") {
    const body = options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : undefined;
    return putJson<T>(path, body);
  }
  if (method === "DELETE") {
    return del<T>(path);
  }
  return fetchWithAuth(`${API_BASE}${path}`, options).then(asJson<T>);
}

api.get = getJson;
api.post = postJson;
api.put = putJson;
api.delete = del;
api.postForm = postForm;
api.getBlob = getBlob;
