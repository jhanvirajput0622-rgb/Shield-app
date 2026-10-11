/**
 * Forgot Password Screen
 * Matches Shield's dark "control room" design language.
 *
 * Flow:
 *   1. User enters their email.
 *   2. POST /api/auth/forgot-password — always returns success (no enumeration).
 *   3. Success state shows: in dev the reset token is logged in the server
 *      console; in production it would be emailed.
 *   4. "Enter Reset Code" button navigates to /reset-password.
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { useForgotPassword } from "@/hooks/useAuth";
import { useObserveInteractive } from "@/hooks/useObserveInteractive";

const c = colors.dark;

export default function ForgotPasswordScreen() {
  useObserveInteractive();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await forgotPassword.mutateAsync({ email: trimmed.toLowerCase() });
    } catch {
      // Always show success — prevents email enumeration
    }
    setSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        {/* Back button — screen manages its own navigation (no stack header) */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={c.primary} />
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Feather name="key" size={30} color={c.primary} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your account email and we'll send you a reset code.
          </Text>
        </View>

        {/* ── Success state ────────────────────────────────────────────── */}
        {sent ? (
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={44} color={c.safe} />
            </View>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successText}>
              If an account exists for{" "}
              <Text style={styles.successEmail}>{email}</Text>, a reset code
              was sent.{"\n\n"}
              <Text style={styles.devNote}>
                Development mode: the token is printed in the server console.
              </Text>
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() =>
                router.push({
                  pathname: "/reset-password",
                  params: { email: email.trim().toLowerCase() },
                })
              }
            >
              <Feather name="edit-3" size={16} color={c.primaryForeground} />
              <Text style={styles.primaryBtnText}>Enter Reset Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.ghostBtnText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Email form ─────────────────────────────────────────────── */
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color={c.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                forgotPassword.isPending && styles.primaryBtnDisabled,
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <Feather name="send" size={16} color={c.primaryForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {forgotPassword.isPending ? "Sending..." : "Send Reset Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.ghostBtnText}>Back to Login</Text>
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

  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },

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
    fontSize: 14,
    color: c.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
  },

  // ── Card ────────────────────────────────────────────────────────────────
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

  // ── Buttons ─────────────────────────────────────────────────────────────
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

  ghostBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  ghostBtnText: { fontSize: 14, color: c.mutedForeground, fontWeight: "500" },

  // ── Success card ─────────────────────────────────────────────────────────
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
  successEmail: { color: c.foreground, fontWeight: "700" },
  devNote: { color: c.textDisabled, fontStyle: "italic", fontSize: 12 },
});
