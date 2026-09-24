import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  getGetShieldSettingsQueryKey,
  useGetShieldSettings,
  useUpdateShieldSettings,
} from "@workspace/api-client-react";
import type { ShieldSettingsUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import colors from "@/constants/colors";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CautionState } from "@/components/ui/CautionState";
import { timeAgo } from "@/lib/utils";
import { MOCK_SETTINGS } from "@/data/mockData";
import { apiFetch } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

// ─── Notification permission helper ──────────────────────────────────────────
async function ensureNotificationPermission(): Promise<
  "granted" | "denied" | "undetermined"
> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";

    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus as "granted" | "denied" | "undetermined";
  } catch (error) {
    console.warn("Push notifications are not supported in Expo Go. Skipping permission check.", error);
    // Default to granted so the toggles work in development/demo mode
    return "granted";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notifDenied, setNotifDenied] = useState(false);
  
  // 2FA Disable state
  const [showDisable2FASheet, setShowDisable2FASheet] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disable2FAError, setDisable2FAError] = useState<string | null>(null);

  const { data: settings } = useGetShieldSettings({
    query: { queryKey: getGetShieldSettingsQueryKey(), staleTime: 60_000 },
  });
  const updateSettings = useUpdateShieldSettings();

  const s = settings ?? MOCK_SETTINGS;
  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Toggle a boolean setting — notification toggles first ensure OS permission
  const toggle = async (key: keyof ShieldSettingsUpdate, value: boolean) => {
    Haptics.selectionAsync();

    // For notification-related keys, request OS permission when enabling
    const notifKeys = [
      "notifyHighRiskApps",
      "notifyPhishingThreats",
      "notifyDeviceUnlock",
    ];
    if (value && notifKeys.includes(key)) {
      const status = await ensureNotificationPermission();
      if (status !== "granted") {
        setNotifDenied(true);
        return; // don't save the toggle — permission not granted
      }
      setNotifDenied(false);
    }

    try {
      const payload = { [key]: value } as ShieldSettingsUpdate;
      await updateSettings.mutateAsync({ data: payload });
      await queryClient.invalidateQueries({ queryKey: ["getShieldSettings"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save this setting.";
      Alert.alert("Setting not saved", message);
    }
  };

  const handleDelete = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      // Call real delete-account endpoint
      await apiFetch("/api/users/me", { method: "DELETE" });
      await logout();
      setShowDeleteSheet(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      setDeleteError(msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disable2FAPassword) {
      setDisable2FAError("Password is required");
      return;
    }
    setDisabling2FA(true);
    setDisable2FAError(null);
    try {
      await apiFetch("/api/auth/2fa/disable", {
        method: "POST",
        body: { password: disable2FAPassword },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDisable2FASheet(false);
      setDisable2FAPassword("");
      queryClient.invalidateQueries({ queryKey: ["getShieldSettings"] });
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setDisable2FAError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setDisabling2FA(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 80 },
      ]}
    >
      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <InfoRow icon="mail" label="Email" value={s.accountEmail} />
          <View style={styles.divider} />
          <InfoRow
            icon="smartphone"
            label="Linked Devices"
            value={String(s.linkedDeviceCount)}
          />
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push("/antitheft")}
          >
            <RowIcon icon="monitor" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Manage Devices</Text>
            </View>
            <Feather name="chevron-right" size={16} color={c.textDisabled} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="smartphone"
            label="High Risk Apps"
            value={s.notifyHighRiskApps}
            onToggle={(v) => toggle("notifyHighRiskApps", v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="link"
            label="Phishing Threats"
            value={s.notifyPhishingThreats}
            onToggle={(v) => toggle("notifyPhishingThreats", v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="lock"
            label="Device Unlock Attempts"
            value={s.notifyDeviceUnlock}
            onToggle={(v) => toggle("notifyDeviceUnlock", v)}
          />
        </View>

        {/* Notification permission denied */}
        {notifDenied && (
          <CautionState
            title="Notifications Denied"
            message="Open Settings to allow Shield to send you security alerts."
            severity="caution"
            onRetry={() => {
              setNotifDenied(false);
              Linking.openSettings();
            }}
            retryLabel="Open Settings"
            compact
          />
        )}

        {/* Permission transparency card */}
        <View style={styles.permCard}>
          <View style={styles.permRow}>
            <View
              style={[styles.permIcon, { backgroundColor: `${c.primary}18` }]}
            >
              <Feather name="bell" size={14} color={c.primary} />
            </View>
            <View style={styles.permInfo}>
              <Text style={styles.permLabel}>Push Notifications</Text>
              <Text style={styles.permDetail}>
                Toggling any alert above will prompt your device for
                notification permission. Shield only sends security-critical
                alerts — no marketing, no digests.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => {
              if (s.twoFactorEnabled) {
                setShowDisable2FASheet(true);
              } else {
                router.push("/two-factor");
              }
            }}
          >
            <RowIcon icon="shield" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Two-Factor Auth</Text>
              <Text style={styles.rowValue}>
                {s.twoFactorEnabled ? "Enabled ✓" : "Disabled"}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: s.twoFactorEnabled ? c.safe : c.warning },
              ]}
            />
            <Feather name="chevron-right" size={16} color={c.textDisabled} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.row}>
            <RowIcon icon="clock" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Last Login</Text>
              <Text style={styles.rowValue}>
                {timeAgo(s.lastLoginAt ?? new Date().toISOString())}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("https://example.com/privacy")}
          >
            <RowIcon icon="file-text" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <Feather name="external-link" size={14} color={c.textDisabled} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("https://example.com/terms")}
          >
            <RowIcon icon="file" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Terms of Service</Text>
            </View>
            <Feather name="external-link" size={14} color={c.textDisabled} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await logout();
            router.replace("/");
          } catch {
            Alert.alert("Unable to log out", "Please try again.");
          }
        }}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={16} color={c.foreground} />
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setShowDeleteSheet(true)}
        activeOpacity={0.8}
      >
        <Feather name="trash-2" size={16} color={c.critical} />
        <Text style={styles.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>

      {/* Delete confirmation sheet */}
      <BottomSheet
        visible={showDeleteSheet}
        onClose={() => { setShowDeleteSheet(false); setDeleteError(null); }}
        title="Delete Account"
        primaryLabel="Permanently Delete Account"
        onPrimary={handleDelete}
        primaryLoading={deletingAccount}
        requireConfirmation="DELETE"
        destructive
      >
        <Text style={styles.deleteWarning}>
          This will permanently delete your account, all linked devices, and all
          security data. This action cannot be undone.
        </Text>
        {deleteError && (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: `${c.danger}15`, borderRadius: 10, borderWidth: 1, borderColor: `${c.danger}30` }}>
            <Text style={{ color: c.danger, fontSize: 13 }}>{deleteError}</Text>
          </View>
        )}
      </BottomSheet>

      {/* Disable 2FA sheet */}
      <BottomSheet
        visible={showDisable2FASheet}
        onClose={() => { setShowDisable2FASheet(false); setDisable2FAError(null); setDisable2FAPassword(""); }}
        title="Disable 2FA"
        primaryLabel="Disable Two-Factor Auth"
        onPrimary={handleDisable2FA}
        primaryLoading={disabling2FA}
        destructive
      >
        <Text style={styles.deleteWarning}>
          Disabling 2FA makes your account less secure. Please enter your password to confirm.
        </Text>
        <View style={styles.inputWrap}>
          <Feather name="lock" size={16} color={c.textDisabled} />
          <TextInput
            style={styles.input}
            value={disable2FAPassword}
            onChangeText={setDisable2FAPassword}
            placeholder="Account Password"
            placeholderTextColor={c.textDisabled}
            secureTextEntry
          />
        </View>
        {disable2FAError && (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: `${c.danger}15`, borderRadius: 10, borderWidth: 1, borderColor: `${c.danger}30` }}>
            <Text style={{ color: c.danger, fontSize: 13 }}>{disable2FAError}</Text>
          </View>
        )}
      </BottomSheet>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowIcon({ icon }: { icon: keyof typeof Feather.glyphMap }) {
  const c = colors.dark;
  return (
    <View style={styles.rowIcon}>
      <Feather name={icon} size={16} color={c.primary} />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <RowIcon icon={icon} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const c = colors.dark;
  return (
    <View style={styles.row}>
      <RowIcon icon={icon} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: c.border, true: `${c.primary}60` }}
        thumbColor={value ? c.primary : c.textDisabled}
        ios_backgroundColor={c.border}
      />
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${c.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, fontWeight: "500", color: c.foreground },
  rowValue: { fontSize: 13, color: c.mutedForeground },
  divider: { height: 1, backgroundColor: c.border, marginLeft: 60 },
  statusDot: { width: 8, height: 8, borderRadius: 999 },

  // Notification permission transparency
  permCard: {
    backgroundColor: c.elevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  permRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  permIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  permInfo: { flex: 1, gap: 4 },
  permLabel: { fontSize: 13, fontWeight: "600", color: c.foreground },
  permDetail: { fontSize: 12, color: c.mutedForeground, lineHeight: 17 },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: `${c.critical}40`,
    backgroundColor: `${c.critical}10`,
    borderRadius: 12,
    paddingVertical: 14,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700", color: c.critical },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingVertical: 14,
  },
  logoutBtnText: { fontSize: 15, fontWeight: "600", color: c.foreground },
  deleteWarning: { fontSize: 14, color: c.mutedForeground, lineHeight: 20 },
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
    marginTop: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: c.foreground,
    padding: 0,
  },
});
