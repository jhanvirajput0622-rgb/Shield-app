/**
 * Login Screen
 *
 * The entry point into Shield. Authenticates against the Shield REST API, then
 * bridges the resulting session into Firebase Auth (see hooks/useAuth.ts and
 * lib/firebaseAuth.ts) so the Firestore-backed data (`mobile*` collections,
 * keyed by the Firebase uid) is reachable immediately after sign-in.
 *
 * Flow:
 *   1. Email + password → POST /api/auth/login.
 *   2. If 2FA is enabled the server answers 401 MFA_REQUIRED; we reveal the
 *      authenticator-code field and resubmit with `otp`.
 *   3. On success: store the module-level user, bridge Firebase, go to tabs.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { useLogin } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { ShieldApiError } from "@/lib/apiClient";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useObserveInteractive } from "@/hooks/useObserveInteractive";

const c = colors.dark;

export default function LoginScreen() {
  useObserveInteractive();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const login = useLogin();
  const { setUser } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSubmit = async () => {
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (showOtp && !otp.trim()) {
      setError("Enter your two-factor authentication code");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await login.mutateAsync({
        email: trimmed,
        password,
        otp: showOtp ? otp.trim() : undefined,
        rememberMe,
      });

      setUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Server signals "password OK, now prove the second factor".
      if (
        err instanceof ShieldApiError &&
        err.status === 401 &&
        err.message === "MFA_REQUIRED"
      ) {
        setShowOtp(true);
        setError("Enter the 6-digit code from your authenticator app.");
        return;
      }

      const message =
        err instanceof Error && err.message
          ? err.message
          : "Sign in failed. Please try again.";
      setError(message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 32, paddingBottom: bottomPad + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Feather name="shield" size={34} color={c.primary} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to protect your device and sync your security settings.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={c.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={c.textDisabled} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={c.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={c.textDisabled} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={c.textDisabled}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                returnKeyType={showOtp ? "next" : "go"}
                onSubmitEditing={showOtp ? undefined : handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={c.textDisabled}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2FA code — revealed only when the server asks for it */}
          {showOtp && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Authentication Code</Text>
              <View style={styles.inputWrap}>
                <Feather name="key" size={16} color={c.textDisabled} />
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  placeholderTextColor={c.textDisabled}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>
          )}

          {/* Remember me + forgot password */}
          <View style={styles.rowBetween}>
            <View style={styles.rememberRow}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: c.border, true: `${c.primary}60` }}
                thumbColor={rememberMe ? c.primary : c.textDisabled}
                ios_backgroundColor={c.border}
              />
              <Text style={styles.rememberText}>Remember me</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/forgot-password")}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign in */}
          <TouchableOpacity
            style={[styles.primaryBtn, login.isPending && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={login.isPending}
          >
            {login.isPending ? (
              <ActivityIndicator size="small" color={c.primaryForeground} />
            ) : (
              <Feather name="log-in" size={16} color={c.primaryForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {login.isPending ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <GoogleSignInButton />
        </View>

        {/* Register */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: 24, gap: 28, flexGrow: 1, justifyContent: "center" },

  brand: { alignItems: "center", gap: 12 },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: `${c.primary}18`,
    borderWidth: 2,
    borderColor: `${c.primary}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: c.foreground },
  subtitle: {
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    gap: 18,
    borderWidth: 1,
    borderColor: c.border,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${c.danger}15`,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: `${c.danger}30`,
  },
  errorText: { fontSize: 13, color: c.danger, flex: 1 },

  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, color: c.foreground, padding: 0 },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rememberText: { fontSize: 13, color: c.mutedForeground },
  linkText: { fontSize: 13, color: c.primary, fontWeight: "600" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: c.primaryForeground },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { fontSize: 12, color: c.textDisabled },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: { fontSize: 14, color: c.mutedForeground },
  footerLink: { fontSize: 14, color: c.primary, fontWeight: "700" },
});
