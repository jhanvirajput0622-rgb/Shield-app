import { useMutation } from "@tanstack/react-query";
import {
  apiFetch,
  apiRouteFetch,
  storeToken,
  clearToken,
  storeRefreshToken,
  clearRefreshToken,
  getRefreshToken,
  setRememberMe,
} from "../lib/apiClient";
import { ensureFirebaseSession, signInToFirebase, signOutOfFirebase } from "../lib/firebaseAuth";

// ─── Response shapes ──────────────────────────────────────────────────────────

interface AuthPayload {
  /** Opaque JWT access token */
  token: string;
  /** accessToken alias (same value as token) */
  accessToken: string;
  /** Long-lived refresh token for silent re-auth */
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    twoFactorEnabled: boolean;
  };
  /** Set by /api/auth/google when the account was just auto-registered */
  isNewUser?: boolean;
}

interface AuthResponse {
  success: boolean;
  data: AuthPayload;
}

interface RefreshResponse {
  success: boolean;
  data: AuthPayload;
}

// ─── Firebase session bridging ─────────────────────────────────────────────────

/**
 * Establish the Firebase Auth session that `firestore.rules` and every service
 * in `lib/firestore/services/` depend on. See lib/firebaseAuth.ts for why the
 * app needs two sessions.
 *
 * Deliberately swallowing failures: the REST session is the app's real
 * identity, and a Firebase outage must degrade the Firestore screens rather than
 * block sign-in. `FirebaseSessionProvider` surfaces the resulting state, so
 * screens still show an honest "syncing unavailable" instead of silently
 * presenting an empty list as "no data".
 */
async function bridgeFirebaseSession(
  credentials: { email: string; password: string } | { email: string }
): Promise<void> {
  try {
    if ("password" in credentials) {
      await signInToFirebase(credentials);
    } else {
      // No password on this path (Google, email OTP), so an identified session
      // is not reachable. The anonymous fallback keeps Firestore readable.
      await ensureFirebaseSession();
    }
  } catch (err) {
    console.warn("[auth] Firebase session not established:", err);
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useRegister() {
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      displayName?: string;
      /** Full name (same as displayName, preferred field) */
      name?: string;
      /** E.164 phone number e.g. +911234567890 */
      phoneNumber?: string;
      /** Used by the server to assert password === confirmPassword */
      confirmPassword?: string;
    }) => {
      const res = await apiRouteFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: input,
      });
      await storeToken(res.data.accessToken ?? res.data.token);
      await storeRefreshToken(res.data.refreshToken);
      await bridgeFirebaseSession({ email: input.email, password: input.password });
      return res.data;
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string; otp?: string; rememberMe?: boolean }) => {
      const res = await apiRouteFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email: input.email, password: input.password, otp: input.otp },
      });
      await storeToken(res.data.accessToken ?? res.data.token);
      await storeRefreshToken(res.data.refreshToken);
      await setRememberMe(input.rememberMe ?? true);
      await bridgeFirebaseSession({ email: input.email, password: input.password });
      return res.data;
    },
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: async (input: { idToken: string }) => {
      const res = await apiFetch<AuthResponse>("/api/auth/google", {
        method: "POST",
        body: { idToken: input.idToken },
        skipAuth: true,
      });
      await storeToken(res.data.accessToken ?? res.data.token);
      await storeRefreshToken(res.data.refreshToken);
      await setRememberMe(true);
      await bridgeFirebaseSession({ email: res.data.user.email });
      return res.data;
    },
  });
}

export function useRequestEmailOtp() {
  return useMutation({
    mutationFn: async (input: { email: string; name?: string }) => {
      return apiFetch<{ success: boolean; message: string; resendAfterSeconds: number }>(
        "/api/auth/email-otp/request",
        { method: "POST", body: input, skipAuth: true }
      );
    },
  });
}

export function useVerifyEmailOtp() {
  return useMutation({
    mutationFn: async (input: { email: string; code: string; authenticatorOtp?: string }) => {
      const res = await apiFetch<AuthResponse>("/api/auth/email-otp/verify", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      await storeToken(res.data.accessToken ?? res.data.token);
      await storeRefreshToken(res.data.refreshToken);
      await setRememberMe(true);
      await bridgeFirebaseSession({ email: input.email });
      return res.data;
    },
  });
}

export function useSetup2FA() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { secret: string; qrCode: string } }>("/api/auth/2fa/setup", {
        method: "POST",
      });
      return res.data;
    },
  });
}

export function useVerify2FA() {
  return useMutation({
    mutationFn: async (input: { otp: string }) => {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/auth/2fa/verify", {
        method: "POST",
        body: input,
      });
      return res;
    },
  });
}

export function useDisable2FA() {
  return useMutation({
    mutationFn: async (input: { password: string }) => {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/auth/2fa/disable", {
        method: "POST",
        body: input,
      });
      return res;
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: { email: string }) => {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      return res;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string; confirmPassword?: string }) => {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: input,
        skipAuth: true,
      });
      return res;
    },
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token available");

      const res = await apiFetch<RefreshResponse>("/api/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        skipAuth: true,
      });
      await storeToken(res.data.accessToken ?? res.data.token);
      await storeRefreshToken(res.data.refreshToken);
      return res.data;
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();
      // Best-effort server-side revocation
      try {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          body: { refreshToken: refreshToken ?? undefined },
        });
      } catch {
        // Even on network failure, clear local credentials
      }
      await clearToken();
      await clearRefreshToken();
      // Drop the Firebase session too. Skipping this would leave the next user
      // to sign in on the device able to read the previous user's
      // `mobile*` documents, since those are keyed by the Firebase uid.
      await signOutOfFirebase();
    },
  });
}
