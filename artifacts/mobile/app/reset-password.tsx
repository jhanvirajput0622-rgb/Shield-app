/**
 * Reset Password Screen
 * User pastes the token from the server console (dev) or email link (prod),
 * enters a new password, and submits.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { useResetPassword } from "@/hooks/useAuth";

const c = colors.dark;

// ─── Password strength bar ────────────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const color = score <= 1 ? c.critical : score <= 3 ? c.warning : c.safe;
  const label = score <= 1 ? "Weak" : score <= 3 ? "Fair" : "Strong";

  return (
    <View style={barStyles.wrap}>
      <View style={barStyles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[barStyles.bar, { backgroundColor: i <= score ? color : c.border }]}
          />
        ))}
      </View>
      <Text style={[barStyles.label, { color }]}>{label}</Text>
    </View>
  );
}
const barStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  bars: { flexDirection: "row", gap: 4, flex: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: "600", width: 44 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const resetPassword = useResetPassword();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleReset = async () => {
    setError(null);

    if (!token.trim()) {
      setError("Reset code is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain an uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain a lowercase letter");
      return;
    }
    if (!/\d/.test(password)) {
      setError("Password must contain a number");
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError("Password must contain a special character");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await resetPassword.mutateAsync({
        token: token.trim(),
        password,
        confirmPassword: confirm,
      });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Please try again."
      );
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
          { paddingTop: topPad + 16, paddingBottom: 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={c.primary} />
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Feather name="lock" size={30} color={c.primary} />
          </View>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            Enter the reset code from your email
            {params.email ? ` (${params.email})` : ""}, then set a new password.
          </Text>
        </View>

        {/* ── Success ─────────────────────────────────────────────────── */}
        {success ? (
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={44} color={c.safe} />
            </View>
            <Text style={styles.successTitle}>Password Updated!</Text>
            <Text style={styles.successText}>
              Your password has been changed successfully. All existing sessions
              have been signed out for your security.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/")}
            >
              <Feather name="log-in" size={16} color={c.primaryForeground} />
              <Text style={styles.primaryBtnText}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form ─────────────────────────────────────────────────── */
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color={c.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Reset Code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Reset Code</Text>
              <View style={styles.inputWrap}>
                <Feather name="hash" size={16} color={c.textDisabled} />
                <TextInput
                  style={styles.input}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Paste code from email / server console"
                  placeholderTextColor={c.textDisabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="oneTimeCode"
                />
              </View>
              <Text style={styles.hint}>
                Development: check the server terminal for the reset code.
              </Text>
            </View>

            {/* New Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={c.textDisabled} />
                <TextInput
                  style={[styles.input, { paddingRight: 8 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 8 characters"
                  placeholderTextColor={c.textDisabled}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={16}
                    color={c.textDisabled}
                  />
                </TouchableOpacity>
              </View>
              <PasswordStrengthBar password={password} />
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={c.textDisabled} />
                <TextInput
                  style={[styles.input, { paddingRight: 8 }]}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat new password"
                  placeholderTextColor={c.textDisabled}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm((v) => !v)}
                >
                  <Feather
                    name={showConfirm ? "eye-off" : "eye"}
                    size={16}
                    color={c.textDisabled}
                  />
                </TouchableOpacity>
              </View>
              {/* Live match indicator */}
              {confirm.length > 0 && (
                <View style={styles.matchRow}>
                  <Feather
                    name={password === confirm ? "check-circle" : "x-circle"}
                    size={13}
                    color={password === confirm ? c.safe : c.danger}
                  />
                  <Text
                    style={[
                      styles.matchText,
                      { color: password === confirm ? c.safe : c.danger },
                    ]}
                  >
                    {password === confirm ? "Passwords match" : "Passwords do not match"}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                resetPassword.isPending && styles.primaryBtnDisabled,
              ]}
              onPress={handleReset}
              activeOpacity={0.85}
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <Feather name="shield" size={16} color={c.primaryForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {resetPassword.isPending ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: 24, gap: 28 },

  backBtn: { width: 44, height: 44, justifyContent: "center" },

  brand: { alignItems: "center", gap: 12 },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: `${c.primary}18`,
    borderWidth: 2,
    borderColor: `${c.primary}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: c.foreground },
  subtitle: {
    fontSize: 13,
    color: c.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
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
  hint: { fontSize: 11, color: c.textDisabled, fontStyle: "italic" },

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
  eyeBtn: { padding: 4 },

  matchRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  matchText: { fontSize: 12, fontWeight: "500" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: c.primaryForeground },

  successCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 28,
    gap: 16,
    borderWidth: 1,
    borderColor: `${c.safe}30`,
    alignItems: "center",
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: `${c.safe}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 20, fontWeight: "800", color: c.foreground },
  successText: {
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
  },
});
