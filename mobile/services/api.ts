/**
 * API client for the existing Express backend.
 *
 * Auth is cookie-based (Passport `connect.sid`), so every request attaches the
 * cookie from SecureStore, and responses that set a cookie (login/register)
 * capture it for storage. The client is used by the auth flow and later by the
 * sync engine — screens read from SQLite, not from this client directly.
 */
import { getSessionCookie, setSessionCookie } from "./secure-store";

/** Set EXPO_PUBLIC_API_URL in .env to point at a deployed backend. */
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

export interface ApiResponse<T> {
  status: number;
  data: T;
  /** Set-Cookie header if the server issued one (login/register). */
  cookie: string | null;
}

export class ApiError extends Error {
  status: number;
  field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

function parseSetCookie(headers: Headers): string | null {
  // RN's fetch exposes set-cookie via get("set-cookie") when possible.
  const raw = headers.get("set-cookie");
  if (raw) return raw.split(";")[0] ?? null;
  const map = (headers as unknown as { map?: Record<string, string | undefined> }).map;
  const joined = map?.["set-cookie"];
  if (joined) return joined.split(";")[0] ?? null;
  return null;
}

export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options?: { body?: unknown; timeoutMs?: number },
): Promise<ApiResponse<T>> {
  const cookie = await getSessionCookie();
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const cookieHeader = parseSetCookie(res.headers);
    if (cookieHeader) {
      await setSessionCookie(cookieHeader);
    }

    let data: T = null as T;
    if (res.status !== 204) {
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text as unknown as T;
        }
      }
    }

    if (!res.ok) {
      const message =
        (data as { message?: string } | null)?.message ?? `Request failed (${res.status})`;
      const field = (data as { field?: string } | null)?.field;
      throw new ApiError(res.status, message, field);
    }

    return { status: res.status, data, cookie: cookieHeader };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Check your connection and try again.");
    }
    throw new ApiError(0, "You're offline. This action needs an internet connection.");
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, options?: { timeoutMs?: number }) =>
    apiRequest<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: { timeoutMs?: number }) =>
    apiRequest<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: { timeoutMs?: number }) =>
    apiRequest<T>("PATCH", path, { ...options, body }),
  del: <T>(path: string, options?: { timeoutMs?: number }) =>
    apiRequest<T>("DELETE", path, options),
};
