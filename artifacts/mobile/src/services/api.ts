/**
 * Centralized API client for the Shield mobile app.
 *
 * All API calls go through this module — the mobile app NEVER connects
 * directly to MongoDB. Every request is proxied through the
 * Node.js + Express backend.
 *
 * Base URL is read from EXPO_PUBLIC_API_URL (set in .env).
 * JWT access tokens are stored in SecureStore (native) / AsyncStorage (web).
 *
 * SECURITY:
 *   - MONGODB_URI is NEVER referenced here.
 *   - JWT_SECRET is NEVER referenced here.
 *   - Private device keys stay in SecureStore / iOS Keychain.
 */

import { getToken, getRefreshToken, storeToken, storeRefreshToken, clearToken, clearRefreshToken } from "../../lib/apiClient";

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in .env
// Dev:  http://<your-lan-ip>:3001
// Prod: https://api.yourshield.com
const RAW_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const getApiBaseUrl = (): string => RAW_BASE.replace(/\/+$/, "");

// ─── Custom API error ─────────────────────────────────────────────────────────

export class ApiServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiServiceError";
  }
  get isUnauthorized() { return this.status === 401; }
  get isNotFound()     { return this.status === 404; }
  get isValidation()   { return this.status === 400; }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface FetchOptions {
  method?: Method;
  body?: unknown;
  /** Skip attaching the Authorization header (login / register) */
  skipAuth?: boolean;
}

let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

async function drainRefreshQueue(token: string | null) {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
}

/**
 * Core fetch wrapper with automatic token refresh.
 * On a 401 response it attempts one silent refresh cycle, then retries.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
  _retry = true
): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (!skipAuth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth && _retry) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error("no refresh token");

        const refreshRes = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) throw new Error("refresh failed");

        const data = await refreshRes.json() as { data: { accessToken: string; refreshToken: string } };
        await storeToken(data.data.accessToken);
        await storeRefreshToken(data.data.refreshToken);
        drainRefreshQueue(data.data.accessToken);
      } catch {
        drainRefreshQueue(null);
        await clearToken();
        await clearRefreshToken();
      } finally {
        _isRefreshing = false;
      }
    } else {
      // Queue up while another refresh is in flight
      await new Promise<void>((resolve) => {
        _refreshQueue.push(() => resolve());
      });
    }
    // Retry once with the new token
    return apiFetch<T>(path, options, false);
  }

  let data: unknown;
  const ct = response.headers.get("content-type") ?? "";
  data = ct.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const err = data as { error?: { message?: string; code?: string }; message?: string };
    const message = err?.error?.message ?? err?.message ?? `HTTP ${response.status}`;
    const code = err?.error?.code ?? "API_ERROR";
    throw new ApiServiceError(response.status, code, message, err);
  }

  return data as T;
}
