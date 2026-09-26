/**
 * Sign Up Screen — Shield mobile security app.
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
import { useRegister, useRequestEmailOtp, useVerifyEmailOtp } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const c = colors.dark;

// ─── Validation helpers ────────────────────────────────────────────────────────

function validateForm(fields: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  agreed: boolean;
}): string | null {
  if (!fields.name.trim()) return "Full name is required";
  if (!fields.email.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    return "Please enter a valid email address";
  if (fields.password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(fields.password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(fields.password)) return "Password must contain a lowercase letter";
  if (!/\d/.test(fields.password)) return "Password must contain a number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(fields.password))
    return "Password must contain a special character";
  if (fields.password !== fields.confirm) return "Passwords do not match";
  if (!fields.agreed) return "You must agree to the Terms & Privacy Policy";
  return null;
}

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const color =
    score <= 1 ? c.critical : score <= 3 ? c.warning : c.safe;
  const label =
    score === 0 ? "" : score <= 1 ? "Weak" : score <= 3 ? "Fair" : "Strong";

  if (!password) return null;
  return (
    <View style={strengthStyles.wrap}>
      <View style={strengthStyles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              strengthStyles.bar,
              { backgroundColor: i <= score ? color : c.border },
            ]}
          />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const strengthStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  bars: { flexDirection: "row", gap: 4, flex: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: "600", width: 44 },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const register = useRegister();
  const requestEmailOtp = useRequestEmailOtp();
  const verifyEmailOtp = useVerifyEmailOtp();
  const { setUser } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false, confirm: false });

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const nameError = touched.name && !name.trim() ? "Full name is required" : null;
  const emailError =
    touched.email && !email.trim()
      ? "Email is required"
      : touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter a valid email address"
      : null;
  const confirmError =
    touched.confirm && !confirm
      ? "Please confirm your password"
      : touched.confirm && confirm !== password
      ? "Passwords do not match"
      : null;

  const handleRegister = async () => {
    setError(null);
    const validation = validateForm({ name, email, password, confirm, agreed });
    if (validation) {
      setError(validation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await register.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        displayName: name.trim(),
        name: name.trim(),
        confirmPassword: confirm,
      });

      setUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // New user — go through onboarding
      router.replace("/onboarding");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(message);
    }
  };

  const handleRequestEmailOtp = async () => {
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms & Privacy Policy.");
      return;
    }
    try {
      await requestEmailOtp.mutateAsync({ email: email.trim().toLowerCase(), name: name.trim() });
      setEmailOtpSent(true);
      setEmailOtp("");
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
      });
      setUser({ id: data.user.id, email: data.user.email, displayName: data.user.displayName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice("Email verified. Opening Shield...");
      setTimeout(() => router.replace(data.isNewUser ? "/onboarding" : "/(tabs)"), 650);
    } catch (err: unknown) {
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
          <Text style={styles.tagline}>Create your secure account</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>YOUR SECURITY STARTS HERE</Text>
          <Text style={styles.cardTitle}>Create your account</Text>
          <Text style={styles.cardSubtitle}>Set up your personal security command center.</Text>

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

          {/* Full Name */}
          <Field
            icon="user"
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Alex Johnson"
            autoComplete="name"
            textContentType="name"
            onBlur={() => setTouched((value) => ({ ...value, name: true }))}
          />
          {nameError && <Text style={styles.fieldError}>{nameError}</Text>}

          {/* Email */}
          <Field
            icon="mail"
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            onBlur={() => setTouched((value) => ({ ...value, email: true }))}
          />
          {emailError && <Text style={styles.fieldError}>{emailError}</Text>}

          {!emailOtpSent ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, (requestEmailOtp.isPending || !agreed) && styles.primaryBtnDisabled]}
              onPress={handleRequestEmailOtp}
              disabled={requestEmailOtp.isPending || !agreed}
            >
              {requestEmailOtp.isPending ? <ActivityIndicator size="small" color={c.foreground} /> : <Feather name="mail" size={17} color={c.foreground} />}
              <Text style={styles.secondaryBtnText}>{requestEmailOtp.isPending ? "Sending code..." : "Sign up with an email code"}</Text>
            </TouchableOpacity>
          ) : (
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
                />
              </View>
              <TouchableOpacity
                style={[styles.secondaryBtn, verifyEmailOtp.isPending && styles.primaryBtnDisabled]}
                onPress={handleVerifyEmailOtp}
                disabled={verifyEmailOtp.isPending}
              >
                {verifyEmailOtp.isPending ? <ActivityIndicator size="small" color={c.foreground} /> : <Feather name="check" size={17} color={c.foreground} />}
                <Text style={styles.secondaryBtnText}>{verifyEmailOtp.isPending ? "Verifying..." : "Verify & Create Account"}</Text>
              </TouchableOpacity>
              <Pressable onPress={handleRequestEmailOtp} disabled={resendCountdown > 0 || requestEmailOtp.isPending} style={styles.centerAction}>
                <Text style={[styles.signinLink, (resendCountdown > 0 || requestEmailOtp.isPending) && styles.disabledLink]}>
                  {requestEmailOtp.isPending ? "Sending..." : resendCountdown > 0 ? `Resend code in 0:${String(resendCountdown).padStart(2, "0")}` : "Resend code"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={c.textDisabled} style={styles.inputIcon} />
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
              <Feather name="lock" size={16} color={c.textDisabled} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 8 }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor={c.textDisabled}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                autoComplete="new-password"
                onBlur={() => setTouched((value) => ({ ...value, confirm: true }))}
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
            {confirmError && <Text style={styles.matchHint}>{confirmError}</Text>}
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => {
              setAgreed((v) => !v);
              Haptics.selectionAsync();
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                agreed && { backgroundColor: c.primary, borderColor: c.primary },
              ]}
            >
              {agreed && <Feather name="check" size={12} color={c.primaryForeground} />}
            </View>
            <Text style={styles.checkText}>
              I agree to the{" "}
              <Text style={styles.checkLink}>Terms & Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (register.isPending || !agreed) && styles.primaryBtnDisabled,
            ]}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={register.isPending || !agreed}
          >
            {register.isPending ? (
              <ActivityIndicator size="small" color={c.primaryForeground} />
            ) : (
              <Feather name="user-plus" size={18} color={c.primaryForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {register.isPending ? "Creating account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleSignInButton />

        </View>

        {/* Sign in link */}
        <Pressable
          style={styles.signinRow}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signinText}>Already have an account? </Text>
          <Text style={styles.signinLink}>Sign In</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Field sub-component ───────────────────────────────────────────────────────

function Field({
  icon,
  label,
  ...props
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name={icon} size={16} color={c.textDisabled} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholderTextColor={c.textDisabled}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
      </View>
    </View>
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
  inputIcon: {},
  input: { flex: 1, fontSize: 15, color: c.foreground, padding: 0 },
  eyeBtn: { padding: 4 },
  matchHint: { fontSize: 12, color: c.danger, fontWeight: "500" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { flex: 1, fontSize: 13, color: c.mutedForeground, lineHeight: 18 },
  checkLink: { color: c.primary, fontWeight: "600" },
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
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 14, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: "700", color: c.foreground },
  centerAction: { alignItems: "center", paddingVertical: 4 },
  disabledLink: { opacity: 0.5 },
  dividerWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { color: c.textDisabled, fontSize: 11, fontWeight: "700" },
  signinRow: { flexDirection: "row", justifyContent: "center" },
  signinText: { fontSize: 14, color: c.mutedForeground },
  signinLink: { fontSize: 14, color: c.primary, fontWeight: "700" },
});
