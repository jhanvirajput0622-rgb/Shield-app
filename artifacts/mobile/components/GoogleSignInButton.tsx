/**
 * "Sign in with Google" button — styled for the dark theme (#0b131a / #16222f / #2fe6c3).
 * Links Google Sign-In credentials to Firebase Auth and the Shield API.
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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import {
  isGoogleAuthConfigured,
  useGoogleAuth,
  idTokenFromResult,
} from "@/lib/googleAuth";
import { signInWithGoogleFirebase } from "@/lib/firebaseAuth";
import { useGoogleLogin } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

const c = colors.dark;

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
        onPress={() =>
          setError(
            "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and GOOGLE_CLIENT_ID on the server."
          )
        }
      >
        <View style={styles.iconCircle}>
          <Text style={styles.googleG}>G</Text>
        </View>
        <Text style={styles.buttonText}>Sign in with Google</Text>
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
        "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and GOOGLE_CLIENT_ID on the server."
      );
      return;
    }
    if (!request) {
      setError("Google sign-in is initializing. Please try again.");
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const authResult = await promptAsync();
      if (authResult?.type !== "success") return;

      const idToken = idTokenFromResult(authResult);
      if (!idToken) {
        setError("Google sign-in did not return an ID token. Please try again.");
        return;
      }

      // 1. Link credentials to Firebase Auth
      await signInWithGoogleFirebase(idToken).catch((fbErr: unknown) => {
        console.warn("Firebase Google Auth warning:", fbErr);
      });

      // 2. Authenticate with Shield API
      const data = await googleLogin.mutateAsync({ idToken });
      setUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess("Signed in with Google. Opening Shield...");
      setTimeout(() => router.replace(data.isNewUser ? "/onboarding" : "/(tabs)"), 650);
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Google sign-in failed. Please try again.";
      setError(message);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          googleLogin.isPending && styles.buttonDisabled,
          Boolean(success) && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={googleLogin.isPending || Boolean(success)}
      >
        {googleLogin.isPending ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <View style={styles.iconCircle}>
            <Text style={styles.googleG}>G</Text>
          </View>
        )}
        <Text style={styles.buttonText}>
          {googleLogin.isPending ? "Signing in with Google..." : "Sign in with Google"}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text accessibilityRole="alert" style={styles.successText}>{success}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 6 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#16222f",
    borderColor: "#23374d",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    backgroundColor: "#1e2d3d",
    borderColor: c.primary,
  },
  buttonDisabled: { opacity: 0.6 },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(47, 230, 195, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    fontSize: 16,
    fontWeight: "900",
    color: c.primary,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  errorText: {
    fontSize: 12,
    color: c.danger,
    textAlign: "center",
  },
  successText: {
    fontSize: 12,
    color: c.safe,
    textAlign: "center",
  },
});