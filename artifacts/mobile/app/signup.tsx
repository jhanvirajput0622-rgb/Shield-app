/**
 * Sign Up Screen — Shield mobile security app.
 */
import React, { useState } from "react";
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
import { useRegister } from "@/hooks/useAuth";
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
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bars: { flexDirection: "row", gap: 4, flex: 1 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: "600", width: 44 },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const register = useRegister();
  const { setUser } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false, confirm: false });

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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/onboarding");
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
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
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Feather name="shield" size={32} color={c.primary} />
          </View>
          <Text style={styles.appName}>SHIELD</Text>
          <Text style={styles.tagline}>Create your secure account</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>YOUR SECURITY STARTS HERE</Text>
          <Text style={styles.cardTitle}>Create your account</Text>
          <Text style={styles.cardSubtitle}>Set up your personal security command center.</Text>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={c.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Full Name Field */}
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

          {/* Email Field */}
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

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={c.textDisabled} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 38 }]}
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

          {/* Confirm Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={c.textDisabled} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 38 }]}
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
            {confirmError && <Text style={styles.fieldError}>{confirmError}</Text>}
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => {
              setAgreed((v) => !v);
              void Haptics.selectionAsync();
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

          {/* Register Button */}
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

          {/* Divider */}
          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <GoogleSignInButton />
        </View>

        {/* Footer Link */}
        <Pressable
          style={styles.signinRow}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signinText}>Already have an account? </Text>
          <Text style={styles.signinLink}>Log in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Input Field Component ─────────────────────────────────────────────────────

function Field({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "words",
  autoComplete,
  textContentType,
  onBlur,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
  autoComplete?: "name" | "email" | "off";
  textContentType?: "name" | "emailAddress";
  onBlur?: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name={icon} size={16} color={c.textDisabled} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textDisabled}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          onBlur={onBlur}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0b131a" },
  container: { paddingHorizontal: 20 },
  brand: { alignItems: "center", marginBottom: 24 },
  logoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(47, 230, 195, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(47, 230, 195, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#f1f5f9",
  },
  tagline: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#16222f",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#23374d",
    padding: 20,
    gap: 14,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: c.primary,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f1f5f9",
    marginTop: -8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: -8,
    marginBottom: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 77, 77, 0.12)",
    borderColor: "rgba(255, 77, 77, 0.3)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: c.danger,
    flex: 1,
  },
  fieldGroup: { gap: 4 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b131a",
    borderColor: "#23374d",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    height: 44,
    color: "#f1f5f9",
    fontSize: 14,
  },
  eyeBtn: { padding: 8, position: "absolute", right: 4 },
  fieldError: {
    fontSize: 11,
    color: c.danger,
    marginTop: -2,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#23374d",
    backgroundColor: "#0b131a",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 12,
    color: "#94a3b8",
    flex: 1,
  },
  checkLink: {
    color: c.primary,
    fontWeight: "600",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.primaryForeground,
  },
  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#23374d" },
  dividerText: { fontSize: 11, fontWeight: "700", color: "#94a3b8" },
  signinRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  signinText: { fontSize: 13, color: "#94a3b8" },
  signinLink: { fontSize: 13, fontWeight: "700", color: c.primary },
});
