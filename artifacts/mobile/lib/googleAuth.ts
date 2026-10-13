/**
 * Google OAuth helpers.
 *
 * Uses expo-auth-session's Google provider to obtain an ID token that the
 * Shield backend verifies at POST /api/auth/google.
 *
 * Client IDs come from the Google Cloud Console:
 *   - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 *   - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    (optional)
 *   - EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (optional)
 *
 * The web client ID must be configured on the server as GOOGLE_CLIENT_ID so
 * the ID token can be verified.
 */
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import type { AuthSessionResult } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
};

const MISSING_ANDROID_CLIENT_ID = "missing-android-client-id";

export function isGoogleAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_IDS.webClientId);
}

/**
 * Extract the Google ID token from a successful auth session result.
 * The ID token is what the backend verifies.
 */
export function idTokenFromResult(result: AuthSessionResult | null): string | null {
  if (result?.type !== "success") return null;
  const idToken = result.params?.id_token;
  return typeof idToken === "string" && idToken.length > 0 ? idToken : null;
}

/** Hook exposing the configured Google auth request + prompt function. */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_IDS.webClientId || undefined,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId || undefined,
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId || MISSING_ANDROID_CLIENT_ID,
    selectAccount: true,
    scopes: ["openid", "profile", "email"],
  });

  return {
    request,
    response,
    promptAsync,
    isConfigured: isGoogleAuthConfigured(),
  };
}