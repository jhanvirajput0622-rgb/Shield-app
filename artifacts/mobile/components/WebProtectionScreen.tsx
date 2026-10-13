import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { LogRow } from "@/components/ui/LogRow";
import { CautionState } from "@/components/ui/CautionState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { usePhishing } from "@/hooks/usePhishing";
import {
  getGetShieldSettingsQueryKey,
  useGetShieldSettings,
  useUpdateShieldSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type CheckState = "idle" | "checking" | "result";

interface WebProtectionScreenProps {
  /** Rendered inside a tab screen (has a bottom tab bar) vs a stack screen. */
  inTabs?: boolean;
}

export default function WebProtectionScreen({
  inTabs = false,
}: WebProtectionScreenProps) {
  const insets = useSafeAreaInsets();

  const [urlInput, setUrlInput] = useState("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [lastResult, setLastResult] = useState<{
    verdict: string;
    message: string;
  } | null>(null);
  const [showClearSheet, setShowClearSheet] = useState(false);

  const {
    log,
    isLoading,
    refetch,
    isError,
    checkUrl,
    clearLog,
    isChecking,
  } = usePhishing();

  // Persist web protection toggle to server
  const queryClient = useQueryClient();
  const { data: serverSettings } = useGetShieldSettings({
    query: { queryKey: getGetShieldSettingsQueryKey(), staleTime: 60_000 },
  });
  const updateSettings = useUpdateShieldSettings();

  const [settings, setSettings] = useState({ webProtectionEnabled: true });

  React.useEffect(() => {
    if (serverSettings && typeof serverSettings.webProtectionEnabled === "boolean") {
      setSettings({ webProtectionEnabled: serverSettings.webProtectionEnabled });
    }
  }, [serverSettings]);

  const handleWebProtectionToggle = async (v: boolean) => {
    setSettings({ webProtectionEnabled: v });
    try {
      await updateSettings.mutateAsync({ data: { webProtectionEnabled: v } });
      queryClient.invalidateQueries({ queryKey: getGetShieldSettingsQueryKey() });
    } catch {
      setSettings({ webProtectionEnabled: !v }); // revert on failure
    }
  };

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const entries = log?.entries ?? [];
  const totalScanned = log?.totalScanned ?? 0;
  const threatsBlocked = log?.threatsBlocked ?? 0;

  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  // Clear the bottom tab bar when embedded in a tab screen, otherwise the
  // activity log would be hidden behind it.
  const bottomPad =
    (Platform.OS === "web" ? 34 : insets.bottom) + (inTabs ? 80 : 32);

  // ── URL phishing check (shared logic) ────────────────────────────────────────
  const runCheck = async (url: string, source: 'manual' | 'qr') => {
    if (!url.trim()) return;
    setCheckState("checking");
    setLastResult(null);

    try {
      const result = await checkUrl(url, source);
      setLastResult({ verdict: result.verdict, message: result.message });

      if (result.verdict === "malicious") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Never default to safe on failure
      setLastResult({
        verdict: "unknown",
        message:
          "We couldn't verify this link right now — treat it with caution.",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setCheckState("result");
    }
  };

  const handleCheck = () => {
    runCheck(urlInput, 'manual');
    setUrlInput("");
  };

  // ── QR scanner ────────────────────────────────────────────────────────────────
  const handleOpenCamera = async () => {
    if (Platform.OS === "web") {
      setCheckState("result");
      setLastResult({
        verdict: "unknown",
        message:
          "QR scanning is not available in the web preview. Use a physical device via Expo Go.",
      });
      return;
    }

    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          setCheckState("result");
          setLastResult({
            verdict: "unknown",
            message:
              "Camera permission denied — enable it in Settings to scan QR codes.",
          });
          return;
        }
      }

      setScannedUrl(null);
      setCameraOpen(true);
    } catch {
      setCheckState("result");
      setLastResult({
        verdict: "unknown",
        message: "Camera access is unavailable right now. Please try again.",
      });
    }
  };

  const handleBarcodeScan = (result: BarcodeScanningResult) => {
    const { data: rawData } = result;
    // Only handle URLs
    const isUrl =
      rawData.startsWith("http://") ||
      rawData.startsWith("https://") ||
      rawData.includes(".");
    if (!isUrl) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScannedUrl(rawData);
    setCameraOpen(false);
    runCheck(rawData, 'qr');
  };

  const handleClear = async () => {
    try {
      await clearLog();
      setShowClearSheet(false);
      Haptics.selectionAsync();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not clear activity.";
      Alert.alert("Activity not cleared", message);
    }
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={c.primary}
          />
        }
      >
        {/* Master toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Web Protection</Text>
              <Text
                style={[
                  styles.toggleStatus,
                  {
                    color: settings.webProtectionEnabled ? c.safe : c.mutedForeground,
                  },
                ]}
              >
                {settings.webProtectionEnabled ? "Active" : "Disabled"}
              </Text>
            </View>
            <Switch
              value={settings.webProtectionEnabled}
              onValueChange={handleWebProtectionToggle}
              trackColor={{ false: c.border, true: `${c.primary}60` }}
              thumbColor={settings.webProtectionEnabled ? c.primary : c.textDisabled}
              ios_backgroundColor={c.border}
            />
          </View>

          <View style={styles.e2eBadge}>
            <Feather name="lock" size={11} color={c.primary} />
            <Text style={styles.e2eText}>
              URLs are hashed and encrypted before leaving your device
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalScanned}</Text>
            <Text style={styles.statLabel}>Links Scanned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: c.critical }]}>
              {threatsBlocked}
            </Text>
            <Text style={[styles.statLabel, { color: c.critical }]}>
              THREATS DETECTED
            </Text>
          </View>
        </View>

        {/* URL Checker */}
        <View style={styles.checkerCard}>
          <Text style={styles.checkerTitle}>Check a Link</Text>

          {/* Scanned URL display */}
          {scannedUrl && (
            <View style={styles.scannedBadge}>
              <Feather name="camera" size={12} color={c.primary} />
              <Text style={styles.scannedText} numberOfLines={1}>
                QR: {scannedUrl}
              </Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Paste a URL to check…"
              placeholderTextColor={c.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="send"
              onSubmitEditing={handleCheck}
            />
            {/* QR scan button */}
            <TouchableOpacity
              style={styles.qrBtn}
              onPress={handleOpenCamera}
              activeOpacity={0.75}
            >
              <Feather name="camera" size={16} color={c.foreground} />
            </TouchableOpacity>
            {/* Check button */}
            <TouchableOpacity
              style={[
                styles.checkBtn,
                (!urlInput.trim() || checkState === "checking" || isChecking) && {
                  opacity: 0.45,
                },
              ]}
              onPress={handleCheck}
              disabled={!urlInput.trim() || checkState === "checking" || isChecking}
              activeOpacity={0.8}
            >
              {(checkState === "checking" || isChecking) ? (
                <ActivityIndicator size="small" color={c.primaryForeground} />
              ) : (
                <Feather name="search" size={16} color={c.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>

          {/* Camera permission state */}
          {cameraPermission &&
            !cameraPermission.granted &&
            !cameraPermission.canAskAgain &&
            Platform.OS !== "web" && (
              <CautionState
                title="Camera Access Denied"
                message="Enable camera access in Settings to scan QR codes for phishing threats."
                severity="caution"
                compact
              />
            )}

          {/* Check result */}
          {checkState === "result" &&
            lastResult &&
            (lastResult.verdict === "unknown" ? (
              <CautionState
                title="Could Not Verify"
                message={lastResult.message}
                severity="caution"
                compact
              />
            ) : lastResult.verdict === "malicious" ? (
              <CautionState
                title="Threat Detected"
                message="This URL matches known phishing or malware patterns. Do not visit it."
                severity="error"
                compact
              />
            ) : (
              <View style={styles.safeResult}>
                <Feather name="check-circle" size={16} color={c.safe} />
                <Text style={styles.safeText}>Link appears safe</Text>
              </View>
            ))}
        </View>

        {/* Permission info card */}
        <View style={styles.permCard}>
          <View style={styles.permRow}>
            <View
              style={[styles.permIcon, { backgroundColor: `${c.primary}18` }]}
            >
              <Feather name="camera" size={14} color={c.primary} />
            </View>
            <View style={styles.permInfo}>
              <Text style={styles.permLabel}>Camera — QR Code Scanning</Text>
              <Text style={styles.permDetail}>
                {cameraPermission?.granted
                  ? "Granted — tap the camera icon to scan a QR code link."
                  : cameraPermission?.canAskAgain === false &&
                      Platform.OS !== "web"
                    ? "Denied — enable in device Settings to use QR scanning."
                    : "Tap the camera icon to request access for QR phishing detection."}
              </Text>
            </View>
            <View
              style={[
                styles.permBadge,
                {
                  backgroundColor: cameraPermission?.granted
                    ? `${c.safe}18`
                    : `${c.warning}18`,
                },
              ]}
            >
              <Text
                style={[
                  styles.permBadgeText,
                  {
                    color: cameraPermission?.granted ? c.safe : c.warning,
                  },
                ]}
              >
                {cameraPermission?.granted
                  ? "GRANTED"
                  : Platform.OS === "web"
                    ? "WEB"
                    : "PENDING"}
              </Text>
            </View>
          </View>
        </View>

        {isError && (
          <CautionState
            title="Log unavailable"
            message="Could not load your activity log from the database."
            severity="caution"
            onRetry={refetch}
            compact
          />
        )}

        {/* Activity log */}
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {entries.length > 0 && (
            <TouchableOpacity onPress={() => setShowClearSheet(true)}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.logList}>
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={24} color={c.textDisabled} />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          ) : (
            entries.map((entry) => (
              <LogRow
                key={entry.id}
                domain={entry.domain}
                verdict={entry.verdict as "malicious" | "safe" | "unknown"}
                checkedAt={entry.checkedAt}
                source={entry.source}
              />
            ))
          )}
        </View>

        <BottomSheet
          visible={showClearSheet}
          onClose={() => setShowClearSheet(false)}
          title="Clear Activity Log"
          primaryLabel="Clear All Entries"
          onPrimary={handleClear}
          destructive
        >
          <Text
            style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 20 }}
          >
            This will remove all {entries.length} log entries from your database history.
          </Text>
        </BottomSheet>
      </ScrollView>

      {/* Full-screen QR camera overlay */}
      {cameraOpen && Platform.OS !== "web" && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setCameraOpen(false)}
        >
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleBarcodeScan}
            />

            {/* Viewfinder overlay */}
            <View style={styles.cameraOverlay}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.scanHint}>
                Point at a QR code containing a URL
              </Text>
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={[styles.closeCamera, { top: insets.top + 16 }]}
              onPress={() => setCameraOpen(false)}
            >
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}

const c = colors.dark;
const CORNER = 24;
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },

  toggleCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleTitle: { fontSize: 17, fontWeight: "700", color: c.foreground },
  toggleStatus: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  e2eBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${c.primary}0D`,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: `${c.primary}25`,
  },
  e2eText: { fontSize: 12, color: c.primary, flex: 1, lineHeight: 16 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  statCard: { flex: 1, alignItems: "center", gap: 4 },
  statNumber: { fontSize: 26, fontWeight: "800", color: c.foreground },
  statLabel: {
    fontSize: 11,
    color: c.mutedForeground,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  statDivider: { width: 1, height: 36, backgroundColor: c.border },

  checkerCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  checkerTitle: { fontSize: 15, fontWeight: "700", color: c.foreground },
  scannedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${c.primary}15`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scannedText: {
    fontSize: 12,
    color: c.primary,
    flex: 1,
    fontFamily: "monospace",
  },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: c.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: c.foreground,
    borderWidth: 1,
    borderColor: c.border,
  },
  qrBtn: {
    backgroundColor: c.elevated,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  checkBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
  },
  safeResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${c.safe}18`,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: `${c.safe}30`,
  },
  safeText: { fontSize: 14, color: c.safe, fontWeight: "600" },

  permCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  permRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  permIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  permInfo: { flex: 1, gap: 3 },
  permLabel: { fontSize: 13, fontWeight: "600", color: c.foreground },
  permDetail: { fontSize: 12, color: c.mutedForeground, lineHeight: 17 },
  permBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  permBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },

  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground },
  clearText: { fontSize: 14, color: c.danger, fontWeight: "600" },
  logList: { gap: 8 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyText: { fontSize: 14, color: c.textDisabled },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  viewfinder: {
    width: 220,
    height: 220,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#2FE6C3",
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  closeCamera: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});