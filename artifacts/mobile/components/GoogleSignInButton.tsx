/**
 * "Continue with Google" button — used on the login and signup screens.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import {
  isGoogleAuthConfigured,
  useGoogleAuth,
  idTokenFromResult,
} from "@/lib/googleAuth";
import { useGoogleLogin } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

const c = colors.dark;

const GOOGLE_BLUE = "#4285F4";

export function GoogleSignInButton() {
  if (!isGoogleAuthConfigured()) {
    return <UnconfiguredGoogleSignInButton />;
  }

  return <ConfiguredGoogleSignInButton />;
}

function UnconfiguredGoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.button}
        onPress={() => setError(
          "Google sign-in isn't configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and GOOGLE_CLIENT_ID on the server."
        )}
      >
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ConfiguredGoogleSignInButton() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const googleLogin = useGoogleLogin();
  const { request, promptAsync, isConfigured } = useGoogleAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePress = async () => {
    setError(null);
    setSuccess(null);

    if (!isConfigured) {
      setError(
        "Google sign-in isn't configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and GOOGLE_CLIENT_ID on the server."
      );
      return;
    }
    if (!request) {
      setError("Google sign-in isn't ready yet. Please try again.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const authResult = await promptAsync();
      // User cancelled/dismissed the Google sheet — do nothing.
      if (authResult?.type !== "success") return;

      const idToken = idTokenFromResult(authResult);
      if (!idToken) {
        setError("Google sign-in didn't return a valid ID token. Please try again.");
        return;
      }

      const data = await googleLogin.mutateAsync({ idToken });
      setUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess("Signed in with Google. Opening Shield...");
      setTimeout(() => router.replace(data.isNewUser ? "/onboarding" : "/(tabs)"), 650);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Google sign-in failed. Please try again.";
      if (/sign-in is not configured/i.test(message)) {
        setError("Google sign-in isn't configured on the server.");
      } else {
        setError(message);
      }
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          googleLogin.isPending && styles.buttonDisabled,
          success && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={googleLogin.isPending || Boolean(success)}
      >
        {googleLogin.isPending ? (
          <ActivityIndicator size="small" color={c.foreground} />
        ) : (
          <Text style={styles.googleG}>G</Text>
        )}
        <Text style={styles.buttonText}>
          {googleLogin.isPending ? "Signing in with Google..." : "Continue with Google"}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text accessibilityRole="alert" style={styles.successText}>{success}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  googleG: {
    fontSize: 20,
    fontWeight: "800",
    color: GOOGLE_BLUE,
    width: 22,
    textAlign: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  errorText: {
    fontSize: 12,
    color: c.danger,
  },
  successText: { fontSize: 12, color: c.safe, textAlign: "center" },
});