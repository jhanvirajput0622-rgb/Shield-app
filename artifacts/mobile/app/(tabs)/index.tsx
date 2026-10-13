import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { StatusPill } from "@/components/ui/StatusPill";
import { LoadingState } from "@/components/ui/LoadingState";
import { CautionState } from "@/components/ui/CautionState";
import { MOCK_PROTECTION_STATUS } from "@/data/mockData";
import {
  overallStatusColor,
  overallStatusLabel,
  riskColor,
  timeAgo,
} from "@/lib/utils";
import { useDashboard, DashboardStats } from "@/hooks/useDashboard";
import { useDbHealth } from "@/hooks/useDbHealth";
import { useObserveInteractive } from "@/hooks/useObserveInteractive";
import { isNetworkUnreachable } from "@/lib/apiClient";

/**
 * Fallback shown when the Shield API can't be reached — the dashboard stays
 * usable (hero, stats, module pills) instead of a blank/full-screen error.
 */
const DASHBOARD_FALLBACK: DashboardStats = {
  score: MOCK_PROTECTION_STATUS.score,
  overall: MOCK_PROTECTION_STATUS.overall,
  lastScanAt: new Date().toISOString(),
  threatsBlocked: MOCK_PROTECTION_STATUS.threatsBlocked,
  appsScanned: MOCK_PROTECTION_STATUS.appsScanned,
  linksScanned: MOCK_PROTECTION_STATUS.linksScanned,
  permissionsStatus: MOCK_PROTECTION_STATUS.permissionsStatus,
  networkStatus: MOCK_PROTECTION_STATUS.networkStatus,
  phishingStatus: MOCK_PROTECTION_STATUS.phishingStatus,
  antitheftStatus: MOCK_PROTECTION_STATUS.antitheftStatus,
  recentEvents: [],
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ActivityRow({ item }: { item: any }) {
  // Server returns SecurityEvent docs with camelCase fields (eventType, occurredAt)
  // There is no separate recentThreats array — all items come from recentEvents
  const c = colors.dark;
  const isBlocked = item.isBlocked === true;

  const icon = isBlocked ? "shield-off" : "activity";
  const iconColor = isBlocked ? c.critical : c.primary;

  const title = item.title || "Security Event";
  // Use camelCase fields that match the server SecurityEvent model
  const meta = `${item.eventType ?? item.event_type ?? "event"} · ${timeAgo(
    item.occurredAt ?? item.occurred_at ?? new Date().toISOString()
  )}`;

  const badgeText = item.severity ?? "info";
  const badgeColor =
    item.severity === "critical"
      ? c.critical
      : item.severity === "high"
      ? c.danger
      : item.severity === "medium"
      ? c.warning
      : c.mutedForeground;

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.activityMeta}>{meta}</Text>
      </View>
      <View style={[styles.activityBadge, { backgroundColor: `${badgeColor}18` }]}>
        <Text style={[styles.activityBadgeText, { color: badgeColor }]}>
          {badgeText?.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * A status card in the Dashboard module overview grid. Shows the module icon
 * tinted by its current risk, a one-line detail, and a status pill.
 */
function ModuleStatusCard({
  icon,
  label,
  status,
  detail,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  status: string;
  detail: string;
  onPress: () => void;
}) {
  const c = colors.dark;
  const fg = riskColor(status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleCard,
        { borderColor: `${fg}35` },
        pressed && styles.moduleCardPressed,
      ]}
    >
      <View style={[styles.moduleCardIcon, { backgroundColor: `${fg}18` }]}>
        <Feather name={icon} size={20} color={fg} />
      </View>
      <Text style={styles.moduleCardTitle}>{label}</Text>
      <Text style={styles.moduleCardDetail} numberOfLines={2}>
        {detail}
      </Text>
      <StatusPill risk={status} size="sm" />
    </Pressable>
  );
}

export default function DashboardScreen() {
  useObserveInteractive();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hasOnboarded } = useApp();
  const c = colors.dark;

  // Redirect to onboarding if user hasn't completed it yet
  useEffect(() => {
    if (hasOnboarded === false) {
      router.replace("/onboarding");
    }
  }, [hasOnboarded, router]);

  const {
    data: s,
    refetch,
    isRefetching,
    isLoading,
    isError,
    error,
  } = useDashboard();

  const serverUnreachable = isNetworkUnreachable(error);
  const display = s ?? DASHBOARD_FALLBACK;
  const showStatusBanner = isError || (!s && !isLoading);

  const {
    data: health,
    isError: healthError,
    refetch: refetchHealth,
  } = useDbHealth();
  const dbDown =
    healthError ||
    (health && !health.success) ||
    (health && health.databaseStatus !== "connected");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (hasOnboarded === null) return <LoadingState />;

  const statusColor = overallStatusColor(display.overall || "protected");
  const statusLabel = overallStatusLabel(display.overall || "protected");
  // Server returns SecurityEvent docs in recentEvents (camelCase). No recentThreats array.
  const recentItems = (display.recentEvents ?? [])
    .slice()
    .sort((a: { occurredAt: any; }, b: { occurredAt: any; }) => {
      const aTime = new Date(a.occurredAt ?? new Date()).getTime();
      const bTime = new Date(b.occurredAt ?? new Date()).getTime();
      return bTime - aTime;
    })
    .slice(0, 4);

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
      {/* DB disconnected banner */}
      {dbDown && (
        <View style={styles.dbBanner}>
          <Feather name="database" size={14} color={c.warning} />
          <Text style={styles.dbBannerText}>
            {health?.databaseStatus === "connecting"
              ? "Connecting to database…"
              : "Database unavailable — showing cached data"}
          </Text>
          <Pressable
            onPress={() => {
              void Promise.all([refetch(), refetchHealth()]);
            }}
          >
            <Feather name="refresh-cw" size={13} color={c.warning} />
          </Pressable>
        </View>
      )}

      {/* Status unavailable banner — only when the fetch truly failed */}
      {showStatusBanner && (
        <CautionState
          title="Status unavailable"
          message={
            serverUnreachable
              ? "We couldn't reach the Shield API. Showing the last known protection status — tap Try Again once your server is reachable."
              : "We couldn't load your protection status. Showing the last known data."
          }
          severity={serverUnreachable ? "error" : "caution"}
          onRetry={() => void refetch()}
          compact
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.appName}>Shield</Text>
        </View>
        <View
          style={[styles.encryptedBadge, { borderColor: `${c.primary}40` }]}
        >
          <Feather name="lock" size={11} color={c.primary} />
          <Text style={styles.encryptedText}>E2E Encrypted</Text>
        </View>
      </View>

      {/* Status hero */}
      <View style={[styles.heroCard, { borderColor: `${statusColor}40` }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <StatusPill risk={display.overall || "safe"} label={statusLabel} />
            <Text style={styles.heroScore}>{display.score || 100}</Text>
            <Text style={styles.heroScoreLabel}>/ 100 Protection Score</Text>
          </View>
          <View
            style={[styles.scoreBadge, { backgroundColor: `${statusColor}18` }]}
          >
            <Feather name="shield" size={32} color={statusColor} />
          </View>
        </View>
        <Text style={styles.lastScan}>Last scan {timeAgo(display.lastScanAt || new Date().toISOString())}</Text>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: c.critical }]}>
            {display.threatsBlocked || 0}
          </Text>
          <Text style={styles.statLabel}>Threats Blocked</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: c.primary }]}>
            {display.appsScanned || 0}
          </Text>
          <Text style={styles.statLabel}>Apps Scanned</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: c.safe }]}>
            {display.linksScanned || 0}
          </Text>
          <Text style={styles.statLabel}>Links Checked</Text>
        </View>
      </View>

      {/* Module status overview — one card per protection module */}
      <Text style={styles.sectionTitle}>Protection Modules</Text>
      <View style={styles.moduleGrid}>
        {[
          {
            icon: "wifi" as const,
            label: "Network Security",
            status: display.networkStatus || "safe",
            detail:
              display.networkStatus === "safe"
                ? "Secure connection"
                : display.networkStatus === "warning"
                  ? "Unsecured network detected"
                  : "Network at risk",
            route: "/network",
          },
          {
            icon: "link" as const,
            label: "Web Protection",
            status: display.phishingStatus || "safe",
            detail: `${display.linksScanned || 0} links checked · ${
              display.threatsBlocked || 0
            } threats blocked`,
            route: "/protection",
          },
          {
            icon: "smartphone" as const,
            label: "App Permissions",
            status: display.permissionsStatus || "safe",
            detail:
              display.permissionsStatus === "safe"
                ? `${display.appsScanned || 0} apps scanned · all clear`
                : display.permissionsStatus === "warning"
                  ? `${display.appsScanned || 0} apps scanned · review flagged apps`
                  : `${display.appsScanned || 0} apps scanned · high-risk apps found`,
            route: "/app",
          },
          {
            icon: "map-pin" as const,
            label: "Anti-Theft",
            status: display.antitheftStatus || "safe",
            detail:
              display.antitheftStatus === "safe"
                ? "Device monitored"
                : display.antitheftStatus === "warning"
                  ? "No linked device"
                  : "Device at risk",
            route: "/antitheft",
          },
        ].map((item) => (
          <ModuleStatusCard
            key={item.label}
            icon={item.icon}
            label={item.label}
            status={item.status}
            detail={item.detail}
            onPress={() => router.push(item.route as any)}
          />
        ))}
      </View>

      {/* Recent Activity */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Activity</Text>
      <View style={styles.moduleList}>
        {recentItems.length === 0 ? (
<View style={styles.emptyState}>
             <Feather name="shield" size={24} color={c.mutedForeground} style={{ marginBottom: 8 }} />
             <Text style={{ color: c.mutedForeground, fontSize: 13 }}>No recent security events.</Text>
           </View>
        ) : (
          recentItems.map((item: any, index: number) => (
            <ActivityRow key={item._id ?? item.id ?? String(index)} item={item} />
          ))
        )}
      </View>

    </ScrollView>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 14,
    color: c.mutedForeground,
    fontWeight: "400",
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: c.foreground,
    letterSpacing: -0.5,
  },
  encryptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: `${c.primary}0D`,
    marginTop: 8,
  },
  encryptedText: {
    fontSize: 11,
    color: c.primary,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLeft: {
    gap: 6,
  },
  heroScore: {
    fontSize: 48,
    fontWeight: "800",
    color: c.foreground,
    lineHeight: 52,
  },
  heroScoreLabel: {
    fontSize: 13,
    color: c.mutedForeground,
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lastScan: {
    fontSize: 13,
    color: c.textDisabled,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    color: c.mutedForeground,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: c.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: c.foreground,
    marginBottom: -8,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  moduleList: {
    gap: 8,
  },
  moduleCard: {
    width: "48%",
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  moduleCardPressed: {
    opacity: 0.8,
  },
  moduleCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  moduleCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: c.foreground,
  },
  moduleCardDetail: {
    fontSize: 12,
    color: c.mutedForeground,
    lineHeight: 16,
    minHeight: 32,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.elevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: c.foreground,
  },
  activityMeta: {
    fontSize: 12,
    color: c.mutedForeground,
  },
  activityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activityBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: c.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  dbBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${c.warning}18`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: `${c.warning}35`,
  },
  dbBannerText: {
    flex: 1,
    fontSize: 13,
    color: c.warning,
    fontWeight: "500",
  },
});
