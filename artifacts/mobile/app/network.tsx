import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  getGetShieldSettingsQueryKey,
  useGetShieldSettings,
  useUpdateShieldSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import colors from "@/constants/colors";
import { CautionState } from "@/components/ui/CautionState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StatusPill } from "@/components/ui/StatusPill";
import { useNetwork, vpnErrorMessage, VPN_PROTOCOLS, VpnProtocol } from "@/hooks/useNetwork";

type VpnState = "disconnected" | "connecting" | "connected" | "error";

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const [vpnError, setVpnError] = useState<string | null>(null);
  const [showResetSheet, setShowResetSheet] = useState(false);
  
  const {
    currentNetwork,
    session,
    isLoading,
    refetch,
    connect,
    disconnect,
    isConnecting,
    protocol,
    setProtocol,
    simulateOpenNetworkDetected
  } = useNetwork();

  // Load settings from server; fall back to local defaults
  const queryClient = useQueryClient();
  const { data: serverSettings } = useGetShieldSettings({
    query: { queryKey: getGetShieldSettingsQueryKey(), staleTime: 60_000 },
  });
  const updateSettings = useUpdateShieldSettings();

  const [settings, setSettings] = useState({
    vpnAutoConnect: serverSettings?.vpnAutoConnect ?? true,
    killSwitchEnabled: serverSettings?.killSwitchEnabled ?? false,
  });

  // Keep local state in sync when server data arrives
  React.useEffect(() => {
    if (serverSettings) {
      setSettings({
        vpnAutoConnect: serverSettings.vpnAutoConnect ?? true,
        killSwitchEnabled: serverSettings.killSwitchEnabled ?? false,
      });
    }
  }, [serverSettings]);

  const handleSettingToggle = async (key: "vpnAutoConnect" | "killSwitchEnabled", value: boolean) => {
    Haptics.selectionAsync();
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await updateSettings.mutateAsync({ data: { [key]: value } });
      queryClient.invalidateQueries({ queryKey: getGetShieldSettingsQueryKey() });
    } catch {
      // Revert optimistic update on failure
      setSettings((prev) => ({ ...prev, [key]: !value }));
    }
  };

  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Real DB state tracking
  const isVpnConnected = session?.connection_status === "connected";
  const vpnState: VpnState = isConnecting || session?.connection_status === "connecting"
    ? "connecting"
    : isVpnConnected
      ? "connected"
      : "disconnected";

  const attemptConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVpnError(null);

    try {
      await connect();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setVpnError(vpnErrorMessage(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleProtocolSelect = (p: VpnProtocol) => {
    if (vpnState === "connecting") return;
    setProtocol(p);
    // If a previous handshake failed, immediately retry with the new protocol.
    if (vpnError) {
      void attemptConnect();
    }
  };

  const handleVpnToggle = async () => {
    if (vpnState === "connecting") return;

    if (isVpnConnected) {
      // Disconnect
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setVpnError(null);
      try {
        await disconnect();
      } catch (e: unknown) {
        setVpnError(vpnErrorMessage(e));
      }
      return;
    }

    // Connect
    await attemptConnect();
  };

  const handleResetNetwork = async () => {
    setVpnError(null);
    setShowResetSheet(false);
    try {
      if (isVpnConnected) await disconnect();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: getGetShieldSettingsQueryKey() });
    } catch (e: unknown) {
      setVpnError(vpnErrorMessage(e));
    }
  };

  const vpnColor =
    vpnState === "connected"
      ? c.safe
      : vpnState === "connecting"
        ? c.warning
        : c.danger;

  const vpnLabel =
    vpnState === "connected"
      ? "Encrypted"
      : vpnState === "connecting"
        ? "Connecting..."
        : "Disconnected";

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={c.primary}
        />
      }
    >
      {/* Connection hero */}
      <View
        style={[
          styles.heroCard,
          !currentNetwork.isSecured && { borderColor: `${c.danger}50` },
        ]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={styles.ssid}>{currentNetwork.ssid}</Text>
            <StatusPill
              risk={currentNetwork.isSecured ? "safe" : "danger"}
              label={currentNetwork.isSecured ? "Secured" : "Unsecured"}
            />
          </View>
          <View style={styles.heroRight}>
            <Feather
              name="wifi"
              size={24}
              color={currentNetwork.isSecured ? c.safe : c.danger}
            />
          </View>
        </View>

        {!currentNetwork.isSecured && (
          <CautionState
            title="Unsecured Network"
            message={`"${currentNetwork.ssid}" is an open network. Your traffic is visible to others. Enable VPN below.`}
            severity="error"
            compact
          />
        )}
      </View>

      {/* DEV TOOLS (Only for simulating open network detection logic) */}
      {currentNetwork.isSecured && (
         <TouchableOpacity 
           style={{ backgroundColor: `${c.warning}20`, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: `${c.warning}50` }}
           onPress={simulateOpenNetworkDetected}
         >
           <Text style={{ color: c.warning, textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
             Dev Tool: Simulate Unsecured Wi-Fi Detection
           </Text>
         </TouchableOpacity>
      )}

      {/* VPN toggle */}
      <View style={styles.vpnCard}>
        <View style={styles.vpnHeader}>
          <View>
            <Text style={styles.vpnLabel}>VPN Protection</Text>
            <Text style={[styles.vpnStatus, { color: vpnColor }]}>
              {vpnLabel}
            </Text>
          </View>
          {vpnState === "connecting" ? (
            <ActivityIndicator size="large" color={c.warning} />
          ) : (
            <TouchableOpacity
              style={[
                styles.vpnToggle,
                {
                  backgroundColor: isVpnConnected
                    ? `${c.safe}20`
                    : `${c.danger}20`,
                  borderColor: isVpnConnected ? `${c.safe}50` : `${c.danger}50`,
                },
              ]}
              onPress={handleVpnToggle}
              activeOpacity={0.8}
            >
              <Feather
                name={isVpnConnected ? "lock" : "unlock"}
                size={24}
                color={isVpnConnected ? c.safe : c.danger}
              />
            </TouchableOpacity>
          )}
        </View>

        {vpnError && (
          <CautionState
            title="VPN Connection Failed"
            message={vpnError}
            severity="error"
            onRetry={handleVpnToggle}
            retryLabel="Retry"
            compact
          />
        )}

        {/* Fallback tunnel protocol — retries the handshake with an alternate
            protocol when the default (WireGuard) one fails. */}
        {vpnError && (
          <View style={styles.fallbackWrap}>
            <Text style={styles.fallbackTitle}>Fallback tunnel protocol</Text>
            <View style={styles.protocolRow}>
              {VPN_PROTOCOLS.map((p) => {
                const active = protocol === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.protocolChip,
                      active && styles.protocolChipActive,
                    ]}
                    onPress={() => handleProtocolSelect(p)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.protocolChipText,
                        active && styles.protocolChipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fallbackHint}>
              Picking a protocol and tapping Retry re-runs the secure tunnel
              handshake with that configuration.
            </Text>
          </View>
        )}

        {isVpnConnected && session && (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Session Details</Text>
            <View style={styles.sessionGrid}>
              <SessionRow
                label="Local IP"
                value={session.local_ip ?? "10.8.0.2"}
              />
              <SessionRow
                label="Protocol"
                value={session.vpn_protocol ?? "WireGuard"}
              />
              <SessionRow
                label="Location"
                value={session.server_region ?? "US East"}
              />
              <SessionRow
                label="Encryption"
                value={session.encryption ?? "ChaCha20-Poly1305"}
              />
            </View>
          </View>
        )}
      </View>

      {/* Settings */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Network Settings</Text>
        <SettingRow
          icon="zap"
          label="Auto-connect on Unsafe Networks"
          value={settings.vpnAutoConnect}
          onToggle={(v) => handleSettingToggle("vpnAutoConnect", v)}
        />
        <View style={styles.divider} />
        <SettingRow
          icon="shield"
          label="Kill Switch"
          sublabel="Block traffic if VPN drops"
          value={settings.killSwitchEnabled}
          onToggle={(v) => handleSettingToggle("killSwitchEnabled", v)}
        />
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Feather name="server" size={15} color={c.primary} />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>Private DNS</Text>
            <Text style={styles.settingSubLabel}>
              shield.dns.internal (read-only)
            </Text>
          </View>
        </View>
      </View>

      {/* Destructive reset */}
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() => setShowResetSheet(true)}
        activeOpacity={0.8}
      >
        <Feather name="refresh-ccw" size={15} color={c.danger} />
        <Text style={styles.resetBtnText}>Reset Network Settings</Text>
      </TouchableOpacity>

      <BottomSheet
        visible={showResetSheet}
        onClose={() => setShowResetSheet(false)}
        title="Reset Network Settings"
        primaryLabel="Reset Settings"
        onPrimary={handleResetNetwork}
        destructive
      >
        <Text
          style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 20 }}
        >
          This will clear all custom network preferences, saved VPN sessions,
          and auto-connect rules. In production, this would require biometric
          confirmation.
        </Text>
      </BottomSheet>
    </ScrollView>
  );
}

function SessionRow({ label, value }: { label: string; value: string }) {
  const c = colors.dark;
  return (
    <View style={styles.sessionRow}>
      <Text style={{ fontSize: 12, color: c.mutedForeground }}>{label}</Text>
      <Text
        style={{
          fontSize: 12,
          color: c.foreground,
          fontFamily: "monospace",
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  value,
  onToggle,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const c = colors.dark;
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Feather name={icon} size={15} color={c.primary} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sublabel && <Text style={styles.settingSubLabel}>{sublabel}</Text>}
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
  content: { paddingHorizontal: 20, gap: 16 },
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroLeft: { gap: 8 },
  heroRight: {},
  ssid: { fontSize: 18, fontWeight: "700", color: c.foreground },
  signalRow: { flexDirection: "row", justifyContent: "space-between" },
  signalText: { fontSize: 12, color: c.textDisabled },
  vpnCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    gap: 14,
  },
  vpnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vpnLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: c.foreground,
    marginBottom: 2,
  },
  vpnStatus: { fontSize: 14, fontWeight: "600" },
  vpnToggle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  sessionCard: {
    backgroundColor: c.elevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    gap: 10,
  },
  fallbackWrap: {
    backgroundColor: `${c.primary}0D`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${c.primary}30`,
    padding: 12,
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  protocolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  protocolChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.elevated,
  },
  protocolChipActive: {
    borderColor: c.primary,
    backgroundColor: `${c.primary}20`,
  },
  protocolChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.mutedForeground,
  },
  protocolChipTextActive: {
    color: c.primary,
  },
  fallbackHint: {
    fontSize: 11,
    color: c.textDisabled,
    lineHeight: 16,
  },
  sessionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionGrid: { gap: 8 },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  settingsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: `${c.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "500", color: c.foreground },
  settingSubLabel: { fontSize: 12, color: c.textDisabled, marginTop: 2 },
  divider: { height: 1, backgroundColor: c.border, marginLeft: 56 },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: `${c.danger}40`,
    backgroundColor: `${c.danger}10`,
    borderRadius: 12,
    paddingVertical: 14,
  },
  resetBtnText: { fontSize: 15, fontWeight: "600", color: c.danger },
});
