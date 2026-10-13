import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { InstalledApp, PermissionsResult } from "@workspace/api-client-react";
import {
  getGetPermissionsQueryKey,
  useGetPermissions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import colors from "@/constants/colors";
import { apiFetch } from "@/lib/apiClient";
import { StatusPill } from "@/components/ui/StatusPill";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CautionState } from "@/components/ui/CautionState";
import { riskColor, timeAgo } from "@/lib/utils";
import { MOCK_APPS } from "@/data/mockData";

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  safe: 4,
};

type IconName = "check" | "package" | "alert-circle" | "settings";

function Icon({
  name,
  size,
  color,
}: {
  name: IconName;
  size: number;
  color: string;
}) {
  const glyphMap: Record<IconName, string> = {
    check: "✓",
    package: "📦",
    "alert-circle": "⚠",
    settings: "⚙",
  };

  return (
    <Text style={{ fontSize: size, color, lineHeight: size }}>
      {glyphMap[name]}
    </Text>
  );
}

export default function AppsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "complete">("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isRefetching, refetch, isError } = useGetPermissions({
    query: { queryKey: getGetPermissionsQueryKey(), staleTime: 60_000 },
  });

  const apps: InstalledApp[] = (data?.apps ?? MOCK_APPS)
    .slice()
    .sort(
      (a: InstalledApp, b: InstalledApp) =>
        (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9),
    );
  const highRiskCount =
    data?.highRiskCount ??
    apps.filter((a) => ["critical", "high"].includes(a.riskLevel)).length;
  const totalApps = data?.totalApps ?? apps.length;
  const lastScanned = data?.lastScannedAt ?? MOCK_APPS[0].lastScannedAt;

  const c = colors.dark;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isScanning = scanPhase === "scanning";

  // Clear the "scan complete" state after a beat so the screen settles back to
  // its resting state. Cleaned up on unmount so it never fires post-navigation.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleScan = async () => {
    if (isScanning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScanPhase("scanning");
    setScanError(null);

    try {
      // The generated useRunPermissionScan mutation cannot carry a body, so we
      // hit the endpoint directly with the app inventory the device serves up.
      const appsBody = (data?.apps?.length ? data.apps : MOCK_APPS).map(
        (a: InstalledApp) => ({
          appName: a.name,
          packageName: a.packageName,
          category: a.category,
          requestedPermissions: a.requestedPermissions,
        }),
      );

      await apiFetch<PermissionsResult>("/api/shield/permissions/scan", {
        method: "POST",
        body: { apps: appsBody },
      });

      // Refetch the permission list from the server to reflect the fresh scan.
      await queryClient.invalidateQueries({
        queryKey: getGetPermissionsQueryKey(),
        refetchType: "active",
      });

      setScanPhase("complete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setScanPhase("idle"), 2500);
    } catch (err: unknown) {
      setScanPhase("idle");
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Scan failed — please try again.";
      setScanError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 80 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={c.primary}
        />
      }
    >
      {/* Hero summary */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroNumber}>{totalApps}</Text>
            <Text style={styles.heroStatLabel}>Apps Scanned</Text>
          </View>
          <View style={[styles.heroDivider]} />
          <View style={styles.heroStat}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={[styles.heroNumber, { color: c.critical }]}>
                {highRiskCount}
              </Text>
              {highRiskCount > 0 && (
                <View
                  style={[styles.pulseDot, { backgroundColor: c.critical }]}
                />
              )}
            </View>
            <Text style={styles.heroStatLabel}>High Risk</Text>
          </View>
          <View style={[styles.heroDivider]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroNumber}>{timeAgo(lastScanned)}</Text>
            <Text style={styles.heroStatLabel}>Last Scan</Text>
          </View>
        </View>
      </View>

      {isError && (
        <CautionState
          title="Scan data unavailable"
          message="Showing last cached results. Could not reach the scan service."
          severity="caution"
          onRetry={refetch}
          compact
        />
      )}

      {scanError && (
        <CautionState
          title="Scan Failed"
          message={scanError}
          severity="error"
          onRetry={handleScan}
          retryLabel="Retry Scan"
          compact
        />
      )}

      {/* Scan button */}
      <TouchableOpacity
        style={[styles.scanBtn, isScanning && { opacity: 0.8 }]}
        onPress={handleScan}
        disabled={isScanning}
        activeOpacity={0.8}
      >
        {isScanning && (
          <ActivityIndicator size="small" color={c.primaryForeground} />
        )}
        {scanPhase === "complete" && (
          <Icon name="check" size={18} color={c.primaryForeground} />
        )}
        <Text style={styles.scanBtnText}>
          {isScanning
            ? "Scanning System..."
            : scanPhase === "complete"
              ? "Scan Complete"
              : "Run Full Scan"}
        </Text>
      </TouchableOpacity>

      {/* App list */}
      <Text style={styles.sectionTitle}>Installed Apps</Text>
      <View style={styles.appList}>
        {apps.map((app) => (
          <TouchableOpacity
            key={app.id}
            style={styles.appRow}
            onPress={() => setSelectedApp(app)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.appIcon,
                { backgroundColor: `${riskColor(app.riskLevel)}18` },
              ]}
            >
              <Icon
                name="package"
                size={18}
                color={riskColor(app.riskLevel)}
              />
            </View>
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{app.name}</Text>
              <View style={styles.permChips}>
                {app.requestedPermissions.slice(0, 3).map((perm) => (
                  <View key={perm} style={styles.chip}>
                    <Text style={styles.chipText}>{perm}</Text>
                  </View>
                ))}
                {app.requestedPermissions.length > 3 && (
                  <View style={[styles.chip, { backgroundColor: c.border }]}>
                    <Text style={styles.chipText}>
                      +{app.requestedPermissions.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <StatusPill risk={app.riskLevel} size="sm" />
          </TouchableOpacity>
        ))}
      </View>

      {/* App detail bottom sheet */}
      <BottomSheet
        visible={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={selectedApp?.name ?? ""}
      >
        {selectedApp && (
          <View style={styles.detailContent}>
            <View style={styles.detailRow}>
              <StatusPill risk={selectedApp.riskLevel} />
              <Text style={styles.detailScore}>
                Risk score: {selectedApp.riskScore}/100
              </Text>
            </View>

            <Text style={styles.detailSectionLabel}>Permissions requested</Text>
            {selectedApp.requestedPermissions.map((perm) => (
              <View key={perm} style={styles.permRow}>
                <Icon
                  name="alert-circle"
                  size={14}
                  color={riskColor(selectedApp.riskLevel)}
                />
                <Text style={styles.permName}>{perm}</Text>
              </View>
            ))}

            {selectedApp.riskReasons.length > 0 && (
              <>
                <Text style={styles.detailSectionLabel}>Why this matters</Text>
                {selectedApp.riskReasons.map((r: string, i: number) => (
                  <Text key={i} style={styles.reason}>
                    • {r}
                  </Text>
                ))}
              </>
            )}

            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => {
                setSelectedApp(null);
                router.push("/(tabs)/settings");
              }}
              activeOpacity={0.8}
            >
              <Icon name="settings" size={14} color={colors.dark.primary} />
              <Text style={styles.settingsBtnText}>Manage in Settings</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>
    </ScrollView>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: { flex: 1, alignItems: "center", gap: 4 },
  heroNumber: { fontSize: 20, fontWeight: "800", color: c.foreground },
  heroStatLabel: { fontSize: 11, color: c.mutedForeground },
  heroDivider: { width: 1, height: 36, backgroundColor: c.border },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginBottom: 8,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanBtnText: { fontSize: 15, fontWeight: "700", color: c.primaryForeground },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.foreground },
  appList: { gap: 8 },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.elevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  appIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: { flex: 1, gap: 6 },
  appName: { fontSize: 14, fontWeight: "600", color: c.foreground },
  permChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    backgroundColor: c.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: { fontSize: 10, color: c.mutedForeground, fontWeight: "500" },
  detailContent: { gap: 14 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailScore: { fontSize: 14, color: c.mutedForeground },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  permRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  permName: { fontSize: 14, color: c.foreground, fontWeight: "500" },
  reason: { fontSize: 13, color: c.mutedForeground, lineHeight: 18 },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${c.primary}18`,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${c.primary}30`,
    marginTop: 8,
  },
  settingsBtnText: { fontSize: 14, fontWeight: "600", color: c.primary },
});
