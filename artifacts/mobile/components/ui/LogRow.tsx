import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";
import { timeAgo } from "@/lib/utils";

interface LogRowProps {
  domain: string;
  verdict: "safe" | "malicious" | "unknown";
  checkedAt: string;
  source: string;
  onPress?: () => void;
}

const VERDICT_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  safe: "check-circle",
  malicious: "x-circle",
  unknown: "alert-circle",
};

const VERDICT_COLOR: Record<string, string> = {
  safe: colors.dark.safe,
  malicious: colors.dark.critical,
  unknown: colors.dark.warning,
};

const VERDICT_LABEL: Record<string, string> = {
  safe: "Safe",
  malicious: "Threat Detected",
  unknown: "Could Not Verify",
};

export function LogRow({
  domain,
  verdict,
  checkedAt,
  source,
  onPress,
}: LogRowProps) {
  const c = colors.dark;
  const vColor = VERDICT_COLOR[verdict] ?? c.mutedForeground;
  const icon = VERDICT_ICON[verdict] ?? "circle";

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: `${vColor}18` }]}>
        <Feather name={icon} size={18} color={vColor} />
      </View>
      <View style={styles.info}>
        <Text style={styles.domain} numberOfLines={1}>
          {domain}
        </Text>
        <Text style={styles.meta}>
          {VERDICT_LABEL[verdict]} · {timeAgo(checkedAt)}
          {source === "auto_scan" && " · Auto-scanned"}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${vColor}18` }]}>
        <Text style={[styles.badgeText, { color: vColor }]}>
          {verdict === "malicious"
            ? "BLOCKED"
            : verdict === "unknown"
              ? "CAUTION"
              : "OK"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: c.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  domain: {
    fontSize: 14,
    fontWeight: "600",
    color: c.foreground,
  },
  meta: {
    fontSize: 12,
    color: c.mutedForeground,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
