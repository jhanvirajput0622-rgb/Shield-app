/**
 * Auth store — module-level singleton with a React hook interface.
 *
 * Token storage is handled by lib/apiClient.ts via lib/secureStorage.ts.
 * All SecureStore keys are validated to contain only [A-Za-z0-9._-].
 */

import { useState, useEffect, useCallback } from "react";
import {
  apiFetch,
  getToken,
  clearToken,
  clearRefreshToken,
  getRememberMe,
} from "@/lib/apiClient";
import { signOutOfFirebase } from "@/lib/firebaseAuth";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  name?: string;
  phoneNumber?: string | null;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

type Listener = () => void;

let _user: AuthUser | null = null;
let _loading = true;
const _listeners = new Set<Listener>();

function notify() {
  for (const l of _listeners) l();
}

/** Call after successful login or register. */
export function setUser(user: AuthUser): void {
  _user = user;
  _loading = false;
  notify();
}

/** Call on logout or detected token expiry. */
export async function clearUser(): Promise<void> {
  _user = null;
  _loading = false;
  await Promise.all([clearToken(), clearRefreshToken()]).catch(() => {});
  // The `mobile*` Firestore collections are keyed by the Firebase uid, so a
  // REST-only sign-out would leave the next person to sign in on this device
  // able to read the previous user's protection settings and security logs.
  // Awaited before notifying so subscribers never re-render into a window
  // where the Firebase session is still live.
  await signOutOfFirebase().catch(() => {});
  notify();
}

/**
 * Silent re-authentication on app launch.
 *
 * Flow:
 *   1. Check Remember Me flag (AsyncStorage — non-sensitive).
 *   2. Read access token from SecureStore via getToken().
 *      (Key is "shield_access_token" — valid for SecureStore.)
 *   3. Call GET /api/auth/me to validate the token and populate user state.
 *   4. On failure, clear tokens and fall through to login guard.
 */
export async function rehydrate(): Promise<void> {
  const rememberMe = await getRememberMe();
  if (!rememberMe) {
    // User explicitly opted out of persistent sessions
    await clearUser();
    return;
  }

  const token = await getToken();
  if (!token) {
    _user = null;
    _loading = false;
    notify();
    return;
  }

  try {
    const res = await apiFetch<{ success: boolean; data: AuthUser }>(
      "/api/auth/me"
    );
    if (res.success && res.data) {
      _user = res.data;
    } else {
      _user = null;
      await clearToken().catch(() => {});
      await clearRefreshToken().catch(() => {});
    }
  } catch (err) {
    // A network-level failure (status 0: server unreachable / offline) does
    // NOT mean the token is bad — the user may simply be disconnected. Keep
    // the stored token so the session survives a reboot/reconnect instead of
    // silently logging the user out. Only clear tokens on a definitive HTTP
    // rejection (expired/invalid token, e.g. 401).
    if (
      err instanceof Error &&
      "status" in err &&
      (err as { status?: number }).status === 0
    ) {
      _loading = false;
      notify();
      return;
    }
    // Token invalid or expired — silent refresh will be attempted by apiFetch
    // on the next authenticated call. Clear stale state now.
    _user = null;
    await clearToken().catch(() => {});
    await clearRefreshToken().catch(() => {});
  }

  _loading = false;
  notify();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender((n) => n + 1);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const logout = useCallback(async () => {
    await clearUser();
  }, []);

  return {
    user: _user,
    isAuthenticated: _user !== null,
    isLoading: _loading,
    setUser,
    logout,
  };
}
