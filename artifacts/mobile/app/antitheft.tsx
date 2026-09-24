import React, { useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { StatusPill } from "@/components/ui/StatusPill";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CautionState } from "@/components/ui/CautionState";
import { timeAgo } from "@/lib/utils";
import { useAntiTheft } from "@/hooks/useAntiTheft";

// ─── Biometric auth helper ────────────────────────────────────────────────────
async function requestBiometricAuth(reason: string): Promise<boolean> {
  if (Platform.OS === "web") return true;

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return true;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return true;
  }
}

// ─── Location helper ──────────────────────────────────────────────────────────
interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

async function getDeviceLocation(): Promise<Coords | null> {
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      if (!navigator?.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 30000 },
      );
    });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AntiTheftScreen() {
  const insets = useSafeAreaInsets();
  
  const [showLockSheet, setShowLockSheet] = useState(false);
  const [showWipeSheet, setShowWipeSheet] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  
  // Track command lifecycle
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  
  const [locating, setLocating] = useState(false);
  const [liveCoords, setLiveCoords] = useState<Coords | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [biometricBlocked, setBiometricBlocked] = useState(false);

  const {
    device: fetchedDevice,
    isLoading,
    isError,
    refetch,
    locateDevice,
    lockDevice,
    wipeDevice,
    useCommandStatus
  } = useAntiTheft();

  const commandStatusQuery = useCommandStatus(activeCommandId);
  const cmdStatus = commandStatusQuery.data?.status;
  const cmdError = commandStatusQuery.data?.error_message;

  // Fallback to loading state structure if device hasn't loaded
  const device = fetchedDevice ?? {
    deviceName: "Loading...",
    status: "offline",
    batteryPercent: 0,
    latitude: null,
    longitude: null,
    lastSeenAt: new Date().toISOString(),
    simStatus: "Unknown",
    networkEncryption: "Unknown",
    gpsPrecision: "Unknown"
  };

  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Cleanup command state when sheets close
  const closeSheets = () => {
    setShowLockSheet(false);
    setShowWipeSheet(false);
    setActiveCommandId(null);
  };

  // ── Locate ──────────────────────────────────────────────────────────────────
  const handleLocate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocating(true);
    setLocationDenied(false);

    try {
      const coords = await getDeviceLocation();
      if (!coords) {
        setLocationDenied(true);
        return;
      }

      setLiveCoords(coords);
      await locateDevice({ lat: coords.latitude, lng: coords.longitude, acc: coords.accuracy });
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setLocationDenied(true);
    } finally {
      setLocating(false);
    }
  };

  // ── Lock ────────────────────────────────────────────────────────────────────
  const handleLock = async () => {
    if (!lockMessage.trim()) return;
    try {
      const res = await lockDevice(lockMessage);
      // res.commandRef is a client-side sentinel that enables polling
      setActiveCommandId(res.commandRef);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // ── Wipe ────────────────────────────────────────────────────────────────────
  const handleWipePress = async () => {
    setBiometricBlocked(false);
    const passed = await requestBiometricAuth(
      "Authenticate to authorise remote device wipe",
    );
    if (!passed) {
      setBiometricBlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setShowWipeSheet(true);
  };

  const handleWipe = async () => {
    try {
      const res = await wipeDevice(device.deviceName);
      // res.commandRef enables status polling
      setActiveCommandId(res.commandRef);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const batteryColor = (device.batteryPercent ?? 0) > 30 ? c.safe : c.warning;
  const displayLat = liveCoords?.latitude ?? device.latitude;
  const displayLng = liveCoords?.longitude ?? device.longitude;
  const accuracyStr = liveCoords?.accuracy
    ? `±${Math.round(liveCoords.accuracy)}m`
    : (device.gpsPrecision ?? "Unknown");
  const coordsLive = !!liveCoords;

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
      {/* Device hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={styles.deviceName}>{device.deviceName}</Text>
            <StatusPill
              risk={
                device.status === "online" || device.status === "active"
                  ? "safe"
                  : device.status === "lost"
                    ? "critical"
                    : "warning"
              }
              label={
                device.status === "online" || device.status === "active"
                  ? "Online"
                  : device.status === "lost"
                    ? "Lost"
                    : "Offline"
              }
            />
          </View>
          <View style={styles.heroRight}>
            <Feather name="battery-charging" size={20} color={batteryColor} />
            <Text style={[styles.battery, { color: batteryColor }]}>
              {device.batteryPercent}%
            </Text>
          </View>
        </View>

        {isError && (
          <CautionState
            title="Database Disconnected"
            message="Could not load device status."
            severity="caution"
            compact
          />
        )}
      </View>

      {/* Location card */}
      <View style={styles.mapCard}>
        <View style={styles.mapPlaceholder}>
          <Feather name="map" size={32} color={c.borderStrong} />
          <Text style={styles.mapPlaceholderText}>
            {coordsLive
              ? "Live location retrieved from this device"
              : "Location preview — native maps in production build"}
          </Text>
        </View>

        {locationDenied && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <CautionState
              title="Location Permission Denied"
              message="Enable location access in Settings so Shield can track your device's position during Anti-Theft mode."
              severity="caution"
              compact
            />
          </View>
        )}

        <View style={styles.locationOverlay}>
          {coordsLive && (
            <View
              style={[
                styles.locationChip,
                {
                  backgroundColor: `${c.safe}18`,
                  borderWidth: 1,
                  borderColor: `${c.safe}30`,
                },
              ]}
            >
              <Feather name="zap" size={12} color={c.safe} />
              <Text style={[styles.locationChipText, { color: c.safe }]}>
                Live GPS
              </Text>
            </View>
          )}
          <View style={styles.locationChip}>
            <Feather name="clock" size={12} color={c.mutedForeground} />
            <Text style={styles.locationChipText}>
              {coordsLive
                ? "just now"
                : `Last seen ${timeAgo(device.lastSeenAt || new Date().toISOString())}`}
            </Text>
          </View>
          {displayLat && displayLng && (
            <View style={styles.locationChip}>
              <Feather name="map-pin" size={12} color={c.primary} />
              <Text style={styles.locationChipText}>
                {displayLat.toFixed(5)}, {displayLng.toFixed(5)}
              </Text>
            </View>
          )}
          <View style={styles.locationChip}>
            <Feather name="crosshair" size={12} color={c.mutedForeground} />
            <Text style={styles.locationChipText}>{accuracyStr}</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <ActionButton
          icon="crosshair"
          label="Locate"
          sublabel={
            locating ? "Getting GPS…" : coordsLive ? "Updated ✓" : "Real GPS"
          }
          onPress={handleLocate}
          loading={locating}
          color={c.primary}
        />
        <ActionButton
          icon="lock"
          label="Lock"
          sublabel="Remote lock"
          onPress={() => setShowLockSheet(true)}
          color={c.warning}
        />
        <ActionButton
          icon="alert-triangle"
          label="Wipe"
          sublabel="Biometric gate"
          onPress={handleWipePress}
          color={c.critical}
          destructive
        />
      </View>

      {/* Biometric blocked notice */}
      {biometricBlocked && (
        <CautionState
          title="Biometric Required"
          message="Face ID / fingerprint authentication is required before initiating a remote wipe. Authentication was not successful."
          severity="error"
          compact
        />
      )}

      {/* Security telemetry */}
      <View style={styles.telemetryCard}>
        <Text style={styles.sectionTitle}>Security Telemetry</Text>
        <TelemetryRow label="SIM Status" value={device.simStatus ?? "Active"} />
        <TelemetryRow label="GPS Precision" value={accuracyStr} />
        <TelemetryRow
          label="Network Encryption"
          value={device.networkEncryption ?? "WPA3"}
        />
        <TelemetryRow
          label="Location Source"
          value={coordsLive ? "Live (this device)" : "Last known (server)"}
          valueColor={coordsLive ? c.safe : c.mutedForeground}
        />
      </View>

      {/* Lock sheet */}
      <BottomSheet
        visible={showLockSheet}
        onClose={closeSheets}
        title={`Lock ${device.deviceName}`}
        primaryLabel={
          !activeCommandId
            ? "Send Lock Command"
            : cmdStatus === "completed"
              ? "Completed ✓"
              : cmdStatus === "failed" || cmdStatus === "expired"
                ? "Retry"
                : "Sending…"
        }
        onPrimary={cmdStatus === "completed" ? closeSheets : handleLock}
        primaryLoading={!!(activeCommandId && cmdStatus !== "completed" && cmdStatus !== "failed" && cmdStatus !== "expired")}
      >
        <Text style={styles.sheetSubtitle}>
          This will lock the screen of{" "}
          <Text style={{ color: c.foreground, fontWeight: "700" }}>
            {device.deviceName}
          </Text>{" "}
          with a custom message.
        </Text>
        <TextInput
          style={styles.lockInput}
          value={lockMessage}
          onChangeText={setLockMessage}
          placeholder="Enter lock screen message…"
          placeholderTextColor={c.textDisabled}
          multiline
          maxLength={120}
          editable={!activeCommandId || cmdStatus === 'failed'}
        />
        {cmdStatus === "acknowledged" && (
          <CautionState
            title="Device received command"
            message="The device has acknowledged the lock command and is executing it."
            severity="caution"
            compact
          />
        )}
        {cmdStatus === "failed" && (
          <CautionState
            title="Couldn't reach device"
            message="The lock command failed or expired."
            severity="caution"
            compact
          />
        )}
      </BottomSheet>

      {/* Wipe sheet */}
      <BottomSheet
        visible={showWipeSheet}
        onClose={closeSheets}
        title="Remote Wipe"
        primaryLabel={
          !activeCommandId
            ? "Permanently Wipe Device"
            : cmdStatus === "completed"
              ? "Completed ✓"
              : cmdStatus === "failed" || cmdStatus === "expired"
                ? "Retry"
                : "Queuing…"
        }
        onPrimary={cmdStatus === "failed" || cmdStatus === "completed" ? closeSheets : handleWipe}
        primaryLoading={!!(activeCommandId && cmdStatus !== "completed" && cmdStatus !== "failed" && cmdStatus !== "expired")}
        requireConfirmation={
          isLoading || device.deviceName === "Loading..."
            ? undefined
            : cmdStatus === "failed"
            ? undefined
            : device.deviceName
        }
        destructive
      >
        {!activeCommandId && (
          <CautionState
            title="This cannot be undone"
            message={`Biometric authentication passed ✓\n\nAll data on ${device.deviceName} will be permanently erased. Wipe only completes on genuine device acknowledgment.`}
            severity="error"
          />
        )}
        {cmdStatus === "acknowledged" && (
          <CautionState
            title="Command Acknowledged"
            message="The wipe command reached the device. Checking execution privileges..."
            severity="caution"
            compact
          />
        )}
        {cmdStatus === "failed" && (
          <CautionState
            title="Wipe Rejected by OS"
            message={cmdError || "OS-level wipe requires MDM profile / native device management capabilities."}
            severity="error"
            compact
          />
        )}
      </BottomSheet>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  sublabel,
  onPress,
  color,
  loading,
  destructive,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  color: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  const backgroundColor = destructive ? `${color}2a` : `${color}15`;
  const borderColor = destructive ? `${color}55` : `${color}35`;

  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor, borderColor }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={loading}
    >
      <Feather name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={styles.actionSublabel}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

function TelemetryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const c = colors.dark;
  const displayColor = valueColor ?? c.text;
  return (
    <View style={styles.telemetryRow}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <Text style={[styles.telemetryValue, { color: displayColor }]}>
        {" "}
        {value}
      </Text>
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
  heroRight: { alignItems: "center", gap: 4 },
  deviceName: { fontSize: 18, fontWeight: "700", color: c.foreground },
  battery: { fontSize: 13, fontWeight: "600" },

  mapCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  mapPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 28,
    backgroundColor: c.elevated,
  },
  mapPlaceholderText: {
    fontSize: 13,
    color: c.textDisabled,
    textAlign: "center",
  },
  locationOverlay: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.elevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locationChipText: { fontSize: 12, color: c.mutedForeground },

  actions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 14, fontWeight: "700" },
  actionSublabel: {
    fontSize: 11,
    color: c.mutedForeground,
    textAlign: "center",
  },

  telemetryCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.foreground },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  telemetryLabel: { fontSize: 13, color: c.mutedForeground },
  telemetryValue: { fontSize: 13, color: c.foreground, fontWeight: "600" },

  sheetSubtitle: { fontSize: 14, color: c.mutedForeground, lineHeight: 20 },
  lockInput: {
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: c.foreground,
    borderWidth: 1,
    borderColor: c.borderStrong,
    minHeight: 80,
    textAlignVertical: "top",
  },
});
