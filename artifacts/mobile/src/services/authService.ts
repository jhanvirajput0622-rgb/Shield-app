/**
 * authService — register, login, logout, token refresh.
 *
 * SECURITY: MONGODB_URI and JWT_SECRET are NEVER used here.
 * The mobile app only holds the opaque JWT and refresh token in SecureStore.
 */
import { apiFetch } from "./api";
import {
  storeToken,
  clearToken,
  storeRefreshToken,
  clearRefreshToken,
  getRefreshToken,
} from "../../lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  twoFactorEnabled: boolean;
}

export interface AuthResult {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthResponse {
  success: boolean;
  data: AuthResult;
}

// ── Register ──────────────────────────────────────────────────────────────────
export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResult> {
  const res = await apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password, displayName },
    skipAuth: true,
  });
  await storeToken(res.data.accessToken ?? res.data.token);
  await storeRefreshToken(res.data.refreshToken);
  return res.data;
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });
  await storeToken(res.data.accessToken ?? res.data.token);
  await storeRefreshToken(res.data.refreshToken);
  return res.data;
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export async function refreshTokens(): Promise<AuthResult> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token stored");

  const res = await apiFetch<AuthResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken },
    skipAuth: true,
  });
  await storeToken(res.data.accessToken ?? res.data.token);
  await storeRefreshToken(res.data.refreshToken);
  return res.data;
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      body: { refreshToken: refreshToken ?? undefined },
    });
  } catch {
    // Always clear local credentials even if server call fails
  }
  await clearToken();
  await clearRefreshToken();
}

// ── Get current user ──────────────────────────────────────────────────────────
export async function getMe(): Promise<AuthUser & {
  protectionScore: number;
  isActive: boolean;
  lastLoginAt: string | null;
  linkedDeviceCount: number;
}> {
  const res = await apiFetch<{
    success: boolean;
    data: AuthUser & {
      protectionScore: number;
      isActive: boolean;
      lastLoginAt: string | null;
      linkedDeviceCount: number;
    };
  }>("/api/auth/me");
  return res.data;
}
