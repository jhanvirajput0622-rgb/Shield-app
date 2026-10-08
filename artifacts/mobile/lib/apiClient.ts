/**
 * Shield API client.
 *
 * Responsibilities:
 *   1. Prepend the backend base URL from EXPO_PUBLIC_API_URL.
 *   2. Attach the stored JWT as a Bearer token.
 *   3. Parse JSON responses.
 *   4. Throw a structured ShieldApiError on non-2xx.
 *   5. On 401, silently refresh once then retry.
 *
 * Token storage uses lib/secureStorage.ts which enforces valid key names.
 * The root cause of the "Invalid key provided to SecureStore" crash was
 * the old keys containing "@" and "/" — those are gone here.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SECURE_KEYS,
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "./secureStorage";

// ─── Base URL ────────────────────────────────────────────────────────────────

const NETWORK_ERROR_MESSAGE =
  "Unable to connect to Shield API. Check that the server is running and your device can reach EXPO_PUBLIC_API_URL.";

const _envBase = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
const _envDomain = (process.env.EXPO_PUBLIC_DOMAIN ?? "").trim();
let _resolvedBase: string | null = null;

const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

/**
 * Best-effort derivation of the dev machine's host from the Expo dev server.
 *
 * When running through Expo Go / a dev build, `Constants.expoConfig.hostUri`
 * points at the Metro bundler (e.g. "192.168.1.42:8081"). The Shield API server
 * runs on the same machine on port 3001, so we can derive a reachable LAN IP
 * automatically — this is what makes physical devices work without hard-coding
 * an IP into EXPO_PUBLIC_API_URL.
 */
function devHostFromExpo(): string | null {
  try {
    const config = Constants.expoConfig ?? (Constants as { manifest2?: unknown });
    const hostUri =
      (config && "hostUri" in config ? (config as { hostUri?: string }).hostUri : undefined) ??
      (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | undefined)
        ?.extra?.expoClient?.hostUri;

    if (!hostUri) return null;
    const host = hostUri.split(":")[0]?.trim();
    if (host && !LOOPBACK_HOSTS.has(host.toLowerCase())) return host;
  } catch {
    // Constants can fail in exotic environments — fall through to the default.
  }
  return null;
}

/**
 * Repair common hand-written mistakes in EXPO_PUBLIC_API_URL.
 *
 * "192.168.1.42:3001" or "api.myshield.com" are the two most common values,
 * and both are invalid as a fetch base: without a scheme the request becomes
 * a relative URL, which native fetch rejects with "Network request failed"
 * before a packet is ever sent — indistinguishable from "server is down".
 */
function normaliseBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * Warn when the configured base URL cannot work on this runtime.
 *
 * Loopback addresses mean "this machine" — correct for iOS Simulator and web,
 * but wrong for an Android emulator (needs 10.0.2.2) and impossible for a
 * physical device. Surfacing it here turns a generic "Cannot connect to API"
 * into a message that names the actual misconfiguration.
 */
function warnIfUnreachableBase(base: string): void {
  if (!__DEV__) return;
  try {
    const host = new URL(base).hostname.toLowerCase();
    if (!LOOPBACK_HOSTS.has(host)) return;
    if (Platform.OS === "web") return;
    if (Platform.OS === "android" && !Device.isDevice) {
      console.warn(
        `[apiClient] ${base} is loopback. Android emulators reach the host ` +
          "machine at http://10.0.2.2:3001, not localhost. " +
          "Set EXPO_PUBLIC_API_URL=http://10.0.2.2:3001 in .env."
      );
      return;
    }
    if (!Device.isDevice) return; // iOS Simulator: localhost is correct.
    console.warn(
      `[apiClient] ${base} is loopback, which a physical device cannot reach. ` +
        "Set EXPO_PUBLIC_API_URL to this machine's LAN IP, e.g. " +
        "http://192.168.1.42:3001 in .env (then restart Metro with -c)."
    );
  } catch {
    // Invalid URL — reported by the caller instead.
  }
}

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *   1. `EXPO_PUBLIC_API_URL` — explicit override (documented way; use a LAN IP
 *      or tunnel URL when testing on a physical device).
 *   2. `EXPO_PUBLIC_DOMAIN` — host-only alias.
 *   3. Auto-detect the dev machine's IP from the Expo/Metro host (works on
 *      physical devices via Expo Go without configuration).
 *   4. `http://localhost:3001` — web / simulator fallback.
 *
 * This is deliberately a runtime function (not a const) so the resolved value
 * is computed exactly once and shared by both the custom wrapper and the
 * generated TanStack client (see app/_layout.tsx).
 */
export function getBaseUrl(): string {
  if (_resolvedBase !== null) return _resolvedBase;

  const explicit = normaliseBaseUrl(_envBase || _envDomain);
  let base = explicit;

  if (!explicit && (_envBase || _envDomain)) {
    console.warn(
      `[apiClient] EXPO_PUBLIC_API_URL="${_envBase || _envDomain}" is not a ` +
        "valid URL — falling back to auto-detection."
    );
  }

  if (!base) {
    const host = devHostFromExpo();
    if (host) {
      base = `http://${host}:3001`;
    } else {
      base = "http://localhost:3001";
    }
    if (__DEV__) {
      console.warn(
        `[apiClient] EXPO_PUBLIC_API_URL is not set — auto-detected ${base}. ` +
          "On a physical device, set the env var to your LAN IP if this is unreachable."
      );
    }
  }

  warnIfUnreachableBase(base);

  _resolvedBase = base;
  return base;
}

/** True when a thrown error was caused by the network/unreachable server. */
export function isNetworkUnreachable(err: unknown): boolean {
  return err instanceof ShieldApiError && err.status === 0;
}

// ─── Token helpers (use secureStorage for all native/web storage) ─────────────

export async function storeToken(token: string): Promise<void> {
  await setSecureItem(SECURE_KEYS.ACCESS_TOKEN, token);
}

export async function getToken(): Promise<string | null> {
  return getSecureItem(SECURE_KEYS.ACCESS_TOKEN);
}

export async function clearToken(): Promise<void> {
  await deleteSecureItem(SECURE_KEYS.ACCESS_TOKEN);
}

export async function storeRefreshToken(token: string): Promise<void> {
  await setSecureItem(SECURE_KEYS.REFRESH_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(SECURE_KEYS.REFRESH_TOKEN);
}

export async function clearRefreshToken(): Promise<void> {
  await deleteSecureItem(SECURE_KEYS.REFRESH_TOKEN);
}

// ─── Remember Me (non-sensitive — AsyncStorage is fine) ───────────────────────

const REMEMBER_ME_ASYNC_KEY = "shield_remember_me";

export async function setRememberMe(value: boolean): Promise<void> {
  await AsyncStorage.setItem(REMEMBER_ME_ASYNC_KEY, String(value));
}

export async function getRememberMe(): Promise<boolean> {
  const val = await AsyncStorage.getItem(REMEMBER_ME_ASYNC_KEY);
  return val !== "false"; // default true
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class ShieldApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "ShieldApiError";
  }
}

// ─── Timeout + network retry ─────────────────────────────────────────────────
// A hung network request previously left the caller (e.g. the permission-scan
// button) spinning forever. We now bound every request with a timeout and retry
// transient network failures once before surfacing an error.

const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_RETRY_DELAY_MS = 800;
const MAX_NETWORK_ATTEMPTS = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Silent refresh lock ──────────────────────────────────────────────────────
// One refresh at a time — concurrent 401s queue on the same promise.

let _refreshPromise: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<string | null> => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await clearToken();
        await clearRefreshToken();
        return null;
      }

      const data = (await res.json()) as {
        success: boolean;
        data: {
          accessToken?: string;
          token?: string;
          refreshToken: string;
        };
      };

      const newAccess = data.data?.accessToken ?? data.data?.token ?? null;
      const newRefresh = data.data?.refreshToken ?? null;

      if (newAccess) await storeToken(newAccess);
      if (newRefresh) await storeRefreshToken(newRefresh);

      return newAccess;
    } catch {
      await clearToken();
      await clearRefreshToken();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Skip attaching the JWT — for /api/auth/login, /register, /refresh */
  skipAuth?: boolean;
  /** Internal — prevents infinite 401 refresh retry */
  _isRetry?: boolean;
  /** Internal — number of network-level retry attempts already made */
  _attempt?: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    skipAuth = false,
    _isRetry = false,
    _attempt = 0,
  } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = `${getBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network-level failure (DNS / refused / timeout / offline). Retry once
    // after a short delay — transient blips during VPN/network switches are
    // common — then throw a structured ShieldApiError with status 0 so callers
    // can distinguish "server unreachable" from genuine HTTP errors.
    if (_attempt + 1 < MAX_NETWORK_ATTEMPTS) {
      await delay(NETWORK_RETRY_DELAY_MS);
      return apiFetch<T>(path, { ...options, _attempt: _attempt + 1 });
    }

    const timedOut = err instanceof Error && err.name === "AbortError";
    const reason = timedOut
      ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
      : "connection refused or unreachable";
    // The base URL is public client config (it is inlined into the bundle as an
    // EXPO_PUBLIC_* var anyway), so always showing it turns a generic
    // "Cannot connect to API" into something that can be fixed in one step.
    const detail = ` (${reason}; tried ${url}, base ${getBaseUrl()})`;
    throw new ShieldApiError(0, null, `${NETWORK_ERROR_MESSAGE}${detail}`);
  }

  // Silent 401 refresh + retry
  if (response.status === 401 && !skipAuth && !_isRetry) {
    const newToken = await silentRefresh();
    if (newToken) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
  }

  // Parse body
  let data: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: { message: string } }).error.message === "string"
        ? (data as { error: { message: string } }).error.message
        : `HTTP ${response.status}`;
    throw new ShieldApiError(response.status, data, message);
  }

  return data as T;
}
