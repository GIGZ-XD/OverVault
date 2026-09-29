/**
 * Local-only JWT storage.
 *
 * DECISION NEEDED (see the team sync notes): this defaults to localStorage
 * under a single key. Pannaga's login page and signing modal should read/write
 * through these three functions rather than touching storage directly, so the
 * mechanism can change in one place (e.g. to an httpOnly cookie set by a Next.js
 * route handler) without every caller changing too.
 */

const STORAGE_KEY = "overvault.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
