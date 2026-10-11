/**
 * Two-Factor Authentication Setup Screen
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
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
import { useSetup2FA, useVerify2FA } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useObserveInteractive } from "@/hooks/useObserveInteractive";

const c = colors.dark;

export default function TwoFactorSetupScreen() {
  useObserveInteractive();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const setup2FA = useSetup2FA();
  const verify2FA = useVerify2FA();

  const [secret, setSecret] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    // Fetch 2FA data on mount
    setup2FA.mutateAsync().then((data: { secret: string; qrCode: string }) => {
      setSecret(data.secret);
      setQrCode(data.qrCode);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load 2FA setup");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopySecret = () => {
    if (secret) {
      Clipboard.setString(secret);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Secret key copied to clipboard");
    }
  };

  const handleVerify = async () => {
    if (!otp.trim()) {
      setError("Please enter the 6-digit code");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);

    try {
      await verify2FA.mutateAsync({ otp: otp.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Two-factor authentication is now enabled.", [
        { text: "OK", onPress: () => {
            router.back();
        } },
      ]);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Verification failed");
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={c.foreground} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Enable 2FA</Text>
          <Text style={styles.subtitle}>
            Secure your account with an authenticator app like Google Authenticator or Authy.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={c.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {setup2FA.isPending ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={styles.loadingText}>Generating secure key...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.stepText}>1. Scan the QR code</Text>
            {qrCode ? (
              <View style={styles.qrContainer}>
                <Image source={{ uri: qrCode }} style={styles.qrImage} />
              </View>
            ) : null}

            <Text style={styles.stepText}>Or enter this code manually:</Text>
            <TouchableOpacity style={styles.secretBox} onPress={handleCopySecret} activeOpacity={0.7}>
              <Text style={styles.secretText}>{secret}</Text>
              <Feather name="copy" size={16} color={c.mutedForeground} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.stepText}>2. Enter the 6-digit code</Text>
            <View style={styles.inputWrap}>
              <Feather name="shield" size={16} color={c.textDisabled} />
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="6-digit code"
                placeholderTextColor={c.textDisabled}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, verify2FA.isPending && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={verify2FA.isPending}
            >
              {verify2FA.isPending ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <Feather name="check-circle" size={18} color={c.primaryForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {verify2FA.isPending ? "Verifying..." : "Verify & Enable"}
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
  container: {
    paddingHorizontal: 24,
    gap: 20,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  header: { gap: 6 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.foreground,
  },
  subtitle: {
    fontSize: 15,
    color: c.mutedForeground,
    lineHeight: 22,
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
  errorText: {
    fontSize: 13,
    color: c.danger,
    flex: 1,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    color: c.mutedForeground,
    fontSize: 15,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.foreground,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff", // QR codes need white bg usually
    padding: 12,
    borderRadius: 12,
    alignSelf: "center",
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  secretBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.elevated,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  secretText: {
    fontSize: 15,
    color: c.primary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "700",
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: 4,
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
  input: {
    flex: 1,
    fontSize: 16,
    color: c.foreground,
    padding: 0,
    letterSpacing: 2,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: c.primaryForeground,
  },
});
