/**
 * Login Screen — Shield mobile security app.
 *
 * - Email + password with validation
 * - Optional MFA (OTP) step when the server returns MFA_REQUIRED
 * - Remember Me checkbox → persisted via setRememberMe()
 * - On success: tokens are stored in SecureStore and the user is routed to
 *   the main Dashboard tab.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useLogin, useRequestEmailOtp, useVerifyEmailOtp } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { ShieldApiError } from "@/lib/apiClient";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const c = colors.dark;

function isMfaRequired(err: unknown): boolean {
  return (
    err instanceof ShieldApiError &&
    err.status === 401 &&
    err.body !== null &&
    typeof err.body === "object" &&
    (err.body as { error?: { message?: string } }).error?.message ===
      "MFA_REQUIRED"
  );
}

function validateFields(fields: {
  email: string;
  password: string;
  otp: string;
  mfaRequired: boolean;
}): string | null {
  if (!fields.email.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    return "Please enter a valid email address";
  if (!fields.password) return "Password is required";
  if (fields.mfaRequired && fields.otp.trim().length < 6)
    return "Enter the 6-digit authentication code";
  return null;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const login = useLogin();
  const requestEmailOtp = useRequestEmailOtp();
  const verifyEmailOtp = useVerifyEmailOtp();
  const { setUser } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [emailOtpMode, setEmailOtpMode] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpAuthenticator, setEmailOtpAuthenticator] = useState("");
  const [emailOtpMfaRequired, setEmailOtpMfaRequired] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const emailError =
    touched.email && !email.trim()
      ? "Email is required"
      : touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter a valid email address"
      : null;
  const passwordError = touched.password && !password ? "Password is required" : null;

  const handleLogin = async () => {
    setError(null);
    const validation = validateFields({ email, password, otp, mfaRequired });
    if (validation) {
      setError(validation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await login.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        otp: mfaRequired && otp.trim() ? otp.trim() : undefined,
        rememberMe,
      });

      setUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
      });
      setMfaRequired(false);
      setOtp("");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // MFA_REQUIRED — prompt for the 6-digit code from their authenticator app.
      if (isMfaRequired(err)) {
        setMfaRequired(true);
        setError("Two-factor authentication is enabled. Enter your 6-digit code.");
        return;
      }

      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    }
  };

  const handleRequestEmailOtp = async () => {
    setError(null);
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address first.");
      return;
    }
    try {
      await requestEmailOtp.mutateAsync({ email: email.trim().toLowerCase() });
      setEmailOtpSent(true);
      setEmailOtp("");
      setEmailOtpMfaRequired(false);
      setResendCountdown(60);
      setNotice(`A verification code was sent to ${email.trim().toLowerCase()}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the code. Try again.");
    }
  };

  const handleVerifyEmailOtp = async () => {
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(emailOtp)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    try {
      const data = await verifyEmailOtp.mutateAsync({
        email: email.trim().toLowerCase(),
        code: emailOtp,
        authenticatorOtp: emailOtpMfaRequired ? emailOtpAuthenticator : undefined,
      });
      setUser({ id: data.user.id, email: data.user.email, displayName: data.user.displayName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice("Email verified. Opening Shield...");
      setTimeout(() => router.replace(data.isNewUser ? "/onboarding" : "/(tabs)"), 650);
    } catch (err: unknown) {
      if (isMfaRequired(err)) {
        setEmailOtpMfaRequired(true);
        setError("Enter the authenticator code to finish signing in.");
        return;
      }
      setError(err instanceof Error ? err.message : "Code verification failed. Try again.");
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
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Feather name="shield" size={32} color={c.primary} />
          </View>
          <Text style={styles.appName}>SHIELD</Text>
          <Text style={styles.tagline}>Welcome back</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>SECURE ACCESS</Text>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to review your protection status.</Text>

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={c.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {notice && (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={14} color={c.safe} />
              <Text style={styles.successText}>{notice}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrap, emailError && styles.inputError]}>
              <Feather name="mail" size={16} color={c.textDisabled} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={c.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                onBlur={() => setTouched((value) => ({ ...value, email: true }))}
              />
            </View>
            {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
          </View>

          {/* Password */}
          {!emailOtpMode && <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, passwordError && styles.inputError]}>
              <Feather name="lock" size={16} color={c.textDisabled} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 8 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={c.textDisabled}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                onBlur={() => setTouched((value) => ({ ...value, password: true }))}
                onSubmitEditing={handleLogin}
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
            {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
          </View>}

          {/* MFA OTP */}
          {!emailOtpMode && mfaRequired && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Two-Factor Code</Text>
              <View style={styles.inputWrap}>
                <Feather name="smartphone" size={16} color={c.textDisabled} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit code"
                  placeholderTextColor={c.textDisabled}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>
          )}

          {emailOtpMode && emailOtpSent && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email Verification Code</Text>
                <View style={styles.inputWrap}>
                  <Feather name="key" size={16} color={c.textDisabled} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={emailOtp}
                    onChangeText={(value) => setEmailOtp(value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    placeholderTextColor={c.textDisabled}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                    onSubmitEditing={handleVerifyEmailOtp}
                  />
                </View>
              </View>
              {emailOtpMfaRequired && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Authenticator Code</Text>
                  <View style={styles.inputWrap}>
                    <Feather name="smartphone" size={16} color={c.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={emailOtpAuthenticator}
                      onChangeText={(value) => setEmailOtpAuthenticator(value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit authenticator code"
                      placeholderTextColor={c.textDisabled}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      onSubmitEditing={handleVerifyEmailOtp}
                    />
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, verifyEmailOtp.isPending && styles.primaryBtnDisabled]}
                onPress={handleVerifyEmailOtp}
                disabled={verifyEmailOtp.isPending}
              >
                {verifyEmailOtp.isPending ? <ActivityIndicator size="small" color={c.primaryForeground} /> : <Feather name="check" size={18} color={c.primaryForeground} />}
                <Text style={styles.primaryBtnText}>{verifyEmailOtp.isPending ? "Verifying..." : "Verify & Continue"}</Text>
              </TouchableOpacity>
              <Pressable
                onPress={handleRequestEmailOtp}
                disabled={resendCountdown > 0 || requestEmailOtp.isPending}
                style={styles.centerAction}
              >
                <Text style={[styles.forgotLink, (resendCountdown > 0 || requestEmailOtp.isPending) && styles.disabledLink]}>
                  {requestEmailOtp.isPending ? "Sending..." : resendCountdown > 0 ? `Resend code in 0:${String(resendCountdown).padStart(2, "0")}` : "Resend code"}
                </Text>
              </Pressable>
            </>
          )}

          {/* Remember me + forgot password */}
          {!emailOtpMode && <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => {
                setRememberMe((v) => !v);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && { backgroundColor: c.primary, borderColor: c.primary },
                ]}
              >
                {rememberMe && <Feather name="check" size={12} color={c.primaryForeground} />}
              </View>
              <Text style={styles.checkText}>Remember me</Text>
            </TouchableOpacity>

            <Pressable onPress={() => router.push("/forgot-password")}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </Pressable>
          </View>}

          {/* Submit */}
          {!emailOtpMode ? <TouchableOpacity
            style={[
              styles.primaryBtn,
              login.isPending && styles.primaryBtnDisabled,
            ]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={login.isPending}
          >
            {login.isPending ? (
              <ActivityIndicator size="small" color={c.primaryForeground} />
            ) : (
              <Feather name="log-in" size={18} color={c.primaryForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {login.isPending ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity> : !emailOtpSent ? (
            <TouchableOpacity
              style={[styles.primaryBtn, requestEmailOtp.isPending && styles.primaryBtnDisabled]}
              onPress={handleRequestEmailOtp}
              disabled={requestEmailOtp.isPending}
            >
              {requestEmailOtp.isPending ? <ActivityIndicator size="small" color={c.primaryForeground} /> : <Feather name="mail" size={18} color={c.primaryForeground} />}
              <Text style={styles.primaryBtnText}>{requestEmailOtp.isPending ? "Sending code..." : "Continue with Email Code"}</Text>
            </TouchableOpacity>
          ) : null}

          <Pressable
            style={styles.centerAction}
            onPress={() => {
              setEmailOtpMode((mode) => !mode);
              setEmailOtpSent(false);
              setEmailOtp("");
              setEmailOtpMfaRequired(false);
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.forgotLink}>{emailOtpMode ? "Use password instead" : "Sign in with an email code"}</Text>
          </Pressable>

          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleSignInButton />

        </View>

        {/* Create account link */}
        <Pressable
          style={styles.signupRow}
          onPress={() => router.push("/signup")}
        >
          <Text style={styles.signupText}>New to Shield? </Text>
          <Text style={styles.signupLink}>Create Account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: 20, gap: 20, alignItems: "center" },
  brand: { alignItems: "center", gap: 10, marginBottom: 4 },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: `${c.primary}18`,
    borderWidth: 2,
    borderColor: `${c.primary}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: c.foreground,
    letterSpacing: 6,
  },
  tagline: { fontSize: 13, color: c.mutedForeground },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: c.border,
    width: "100%",
    maxWidth: 520,
  },
  cardEyebrow: { fontSize: 11, fontWeight: "700", color: c.primary, letterSpacing: 1.2 },
  cardTitle: { fontSize: 26, fontWeight: "800", color: c.foreground },
  cardSubtitle: { fontSize: 14, color: c.mutedForeground, marginTop: -8 },
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
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${c.safe}15`, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: `${c.safe}30` },
  successText: { fontSize: 13, color: c.safe, flex: 1 },
  fieldError: { fontSize: 12, color: c.danger, marginTop: -2 },
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
  inputError: { borderColor: `${c.danger}99` },
  inputIcon: {},
  input: { flex: 1, fontSize: 15, color: c.foreground, padding: 0 },
  eyeBtn: { padding: 4 },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 13, color: c.mutedForeground },
  forgotLink: { fontSize: 13, color: c.primary, fontWeight: "600" },
  disabledLink: { opacity: 0.5 },
  centerAction: { alignItems: "center", paddingVertical: 4 },
  dividerWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { color: c.textDisabled, fontSize: 11, fontWeight: "700" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: c.primaryForeground },
  signupRow: { flexDirection: "row", justifyContent: "center" },
  signupText: { fontSize: 14, color: c.mutedForeground },
  signupLink: { fontSize: 14, color: c.primary, fontWeight: "700" },
});